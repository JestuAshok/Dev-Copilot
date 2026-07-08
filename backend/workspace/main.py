from fastapi import FastAPI, HTTPException
from typing import List
from models import Student, StudentCreate, StudentUpdate

app = FastAPI(title="Student Management API")

# In-memory database
students_db: List[Student] = []
next_id = 1

@app.post("/students/", response_model=Student, status_code=201)
async def create_student(student: StudentCreate):
    global next_id
    new_student = Student(id=next_id, **student.model_dump())
    students_db.append(new_student)
    next_id += 1
    return new_student

@app.get("/students/", response_model=List[Student])
async def get_all_students():
    return students_db

@app.get("/students/{student_id}", response_model=Student)
async def get_student(student_id: int):
    for student in students_db:
        if student.id == student_id:
            return student
    raise HTTPException(status_code=404, detail="Student not found")

@app.put("/students/{student_id}", response_model=Student)
async def update_student(student_id: int, student_update: StudentUpdate):
    for idx, student in enumerate(students_db):
        if student.id == student_id:
            updated_data = student_update.model_dump(exclude_unset=True)
            updated_student = student.model_copy(update=updated_data)
            students_db[idx] = updated_student
            return updated_student
    raise HTTPException(status_code=404, detail="Student not found")

@app.delete("/students/{student_id}", status_code=204)
async def delete_student(student_id: int):
    global students_db
    initial_len = len(students_db)
    students_db = [student for student in students_db if student.id != student_id]
    if len(students_db) == initial_len:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"message": "Student deleted successfully"}
