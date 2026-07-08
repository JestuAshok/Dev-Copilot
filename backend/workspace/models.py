from pydantic import BaseModel
from typing import Optional

class Student(BaseModel):
    id: int
    name: str
    age: int
    major: str

class StudentCreate(BaseModel):
    name: str
    age: int
    major: str

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    major: Optional[str] = None