from pydantic import BaseModel, EmailStr
from typing import Optional


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str = "patient"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str

    class Config:
        from_attributes = True


class PatientCreate(BaseModel):
    full_name: str
    date_of_birth: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None


class PatientResponse(BaseModel):
    id: int
    full_name: str
    date_of_birth: Optional[str]
    phone: Optional[str]
    emergency_contact: Optional[str]
    emergency_phone: Optional[str]

    class Config:
        from_attributes = True


class MedicationCreate(BaseModel):
    patient_id: int
    name: str
    dosage: str
    frequency: str
    instructions: Optional[str] = None
    quantity: int = 0


class MedicationResponse(BaseModel):
    id: int
    patient_id: int
    name: str
    dosage: str
    frequency: str
    instructions: Optional[str]
    quantity: int
    active: bool

    class Config:
        from_attributes = True


class ScheduleCreate(BaseModel):
    medication_id: int
    time: str
    dosage: str


class ScheduleResponse(BaseModel):
    id: int
    medication_id: int
    time: str
    dosage: str
    active: bool

    class Config:
        from_attributes = True


class DoseRecordCreate(BaseModel):
    schedule_id: int
    dose_date: str
    status: str


class DoseRecordResponse(BaseModel):
    id: int
    schedule_id: int
    dose_date: str
    status: str

    class Config:
        from_attributes = True