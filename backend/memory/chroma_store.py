import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from config.settings import settings
from database.connection import get_db_setting

logger = logging.getLogger("copilot.memory")

# Configure GenAI embeddings helper
def get_embedding(text: str, api_key: Optional[str] = None) -> List[float]:
    key = api_key or get_db_setting("gemini_api_key") or settings.gemini_api_key
    if not key:
        logger.warning("No Gemini API Key configured for embedding generation.")
        # Return a zero vector as safety fallback
        return [0.0] * 768
    
    try:
        genai.configure(api_key=key)
        # Using standard embedding model
        result = genai.embed_content(
            model="models/embedding-001",
            content=text,
            task_type="retrieval_document"
        )
        return result['embedding']
    except Exception as e:
        logger.error(f"Error fetching embedding from Gemini: {e}")
        return [0.0] * 768

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    import numpy as np
    a = np.array(v1)
    b = np.array(v2)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


class FallbackVectorStore:
    """Pure Python + JSON Vector Store used if ChromaDB is unavailable."""
    def __init__(self, storage_dir: Path):
        self.file_path = storage_dir / "fallback_vector_store.json"
        self.data: List[Dict[str, Any]] = []
        self._load()

    def _load(self):
        if self.file_path.exists():
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    self.data = json.load(f)
            except Exception as e:
                logger.error(f"Failed to load fallback vector DB JSON: {e}")
                self.data = []

    def _save(self):
        try:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to save fallback vector DB JSON: {e}")

    def add(self, ids: List[str], documents: List[str], metadatas: List[Dict[str, Any]], api_key: Optional[str] = None):
        for doc_id, doc, meta in zip(ids, documents, metadatas):
            embedding = get_embedding(doc, api_key=api_key)
            # Remove old version if it exists
            self.data = [item for item in self.data if item["id"] != doc_id]
            self.data.append({
                "id": doc_id,
                "document": doc,
                "metadata": meta,
                "embedding": embedding
            })
        self._save()

    def query(self, query_text: str, n_results: int = 5, api_key: Optional[str] = None) -> Dict[str, List]:
        query_emb = get_embedding(query_text, api_key=api_key)
        
        scored_items = []
        for item in self.data:
            sim = cosine_similarity(query_emb, item["embedding"])
            scored_items.append((sim, item))
        
        # Sort descending by similarity
        scored_items.sort(key=lambda x: x[0], reverse=True)
        top_items = scored_items[:n_results]
        
        results = {
            "documents": [[item["document"] for _, item in top_items]],
            "metadatas": [[item["metadata"] for _, item in top_items]],
            "ids": [[item["id"] for _, item in top_items]],
            "distances": [[1.0 - sim for sim, _ in top_items]]
        }
        return results

    def delete_by_metadata_filter(self, key: str, value: Any):
        self.data = [item for item in self.data if item.get("metadata", {}).get(key) != value]
        self._save()


# Instantiate vector db client
try:
    import chromadb
    CHROMA_AVAILABLE = True
    logger.info("ChromaDB library detected. Using native client.")
except ImportError:
    CHROMA_AVAILABLE = False
    logger.warning("ChromaDB library not installed or failed to import. Using JSON fallback vector store.")


class VectorMemory:
    def __init__(self):
        self.collection_name = "copilot_memory"
        self.chroma_client = None
        self.fallback_db = None
        
        if CHROMA_AVAILABLE:
            try:
                self.chroma_client = chromadb.PersistentClient(path=str(settings.chroma_db_dir))
                # Get or create collection
                self.collection = self.chroma_client.get_or_create_collection(name=self.collection_name)
            except Exception as e:
                logger.error(f"Error initializing ChromaDB: {e}. Falling back to JSON vector store.")
                self.chroma_client = None
                self.fallback_db = FallbackVectorStore(settings.chroma_db_dir)
        else:
            self.fallback_db = FallbackVectorStore(settings.chroma_db_dir)

    def add_memory(self, doc_id: str, content: str, metadata: Dict[str, Any], api_key: Optional[str] = None):
        """Adds a text document with metadata to memory."""
        try:
            if self.chroma_client:
                # Retrieve embedding
                embedding = get_embedding(content, api_key=api_key)
                self.collection.upsert(
                    ids=[doc_id],
                    documents=[content],
                    metadatas=[metadata],
                    embeddings=[embedding]
                )
            else:
                self.fallback_db.add(ids=[doc_id], documents=[content], metadatas=[metadata], api_key=api_key)
        except Exception as e:
            logger.error(f"Failed to write to vector memory: {e}")

    def search_memory(self, query: str, limit: int = 5, api_key: Optional[str] = None) -> List[Dict[str, Any]]:
        """Searches vector memory and returns lists of matching records."""
        try:
            if self.chroma_client:
                query_emb = get_embedding(query, api_key=api_key)
                results = self.collection.query(
                    query_embeddings=[query_emb],
                    n_results=limit
                )
            else:
                results = self.fallback_db.query(query, n_results=limit, api_key=api_key)
                
            formatted = []
            if results and results.get("documents") and len(results["documents"]) > 0:
                docs = results["documents"][0]
                metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
                ids = results["ids"][0] if results.get("ids") else [""] * len(docs)
                
                for d, m, i in zip(docs, metas, ids):
                    formatted.append({
                        "id": i,
                        "content": d,
                        "metadata": m
                    })
            return formatted
        except Exception as e:
            logger.error(f"Error searching vector memory: {e}")
            return []

    def clear_project_memory(self, project_name: str):
        """Delete memories associated with a specific project/workspace context."""
        try:
            if self.chroma_client:
                # Chroma collections support filtering delete
                self.collection.delete(where={"project": project_name})
            else:
                self.fallback_db.delete_by_metadata_filter("project", project_name)
        except Exception as e:
            logger.error(f"Failed to clear project vector memory: {e}")

# Global instance
memory_db = VectorMemory()
