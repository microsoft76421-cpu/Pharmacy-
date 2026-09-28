from datetime import date, datetime
from typing import List

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
)

from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import get_db

from models import (
    User,
    Patient,
    Medication,
    MedicationSchedule,
    DoseRecord,
)

from schemas import (
    RegisterRequest,
    LoginRequest,
    UserResponse,
    PatientCreate,
    PatientResponse,
    MedicationCreate,
    MedicationResponse,
    ScheduleCreate,
    ScheduleResponse,
    DoseRecordCreate,
    DoseRecordResponse,
)

from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="MediSafe",
    description="Smart Medicine & Patient Safety System",
    version="1.0.0",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():
    return {
        "message": "MediSafe API is running",
        "status": "online",
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "MediSafe",
    }


# =========================================================
# AUTHENTICATION
# =========================================================

@app.post("/api/register")
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):
    existing_user = (
        db.query(User)
        .filter(User.email == data.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    if len(data.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters.",
        )

    new_user = User(
        full_name=data.full_name,
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(new_user.id)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "full_name": new_user.full_name,
            "email": new_user.email,
            "role": new_user.role,
        },
    }


@app.post("/api/login")
def login(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.email == data.email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not verify_password(
        data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(user.id)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
        },
    }


@app.get("/api/me")
def get_me(
    user: User = Depends(get_current_user),
):
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
    }


# =========================================================
# PATIENTS
# =========================================================

@app.post(
    "/api/patients",
    response_model=PatientResponse,
)
def create_patient(
    data: PatientCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    patient = Patient(
        user_id=user.id,
        full_name=data.full_name,
        date_of_birth=data.date_of_birth,
        phone=data.phone,
        emergency_contact=data.emergency_contact,
        emergency_phone=data.emergency_phone,
    )

    db.add(patient)
    db.commit()
    db.refresh(patient)

    return patient


@app.get(
    "/api/patients",
    response_model=List[PatientResponse],
)
def get_patients(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(Patient)
        .filter(
            Patient.user_id == user.id
        )
        .order_by(
            Patient.created_at.desc()
        )
        .all()
    )


@app.get(
    "/api/patients/{patient_id}",
    response_model=PatientResponse,
)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    patient = (
        db.query(Patient)
        .filter(
            Patient.id == patient_id,
            Patient.user_id == user.id,
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    return patient


# =========================================================
# MEDICATIONS
# =========================================================

@app.post(
    "/api/medications",
    response_model=MedicationResponse,
)
def create_medication(
    data: MedicationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    patient = (
        db.query(Patient)
        .filter(
            Patient.id == data.patient_id,
            Patient.user_id == user.id,
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    medication = Medication(
        patient_id=data.patient_id,
        name=data.name,
        dosage=data.dosage,
        frequency=data.frequency,
        instructions=data.instructions,
        quantity=data.quantity,
        active=True,
    )

    db.add(medication)
    db.commit()
    db.refresh(medication)

    return medication


@app.get(
    "/api/medications/{patient_id}",
    response_model=List[MedicationResponse],
)
def get_medications(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    patient = (
        db.query(Patient)
        .filter(
            Patient.id == patient_id,
            Patient.user_id == user.id,
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    return (
        db.query(Medication)
        .filter(
            Medication.patient_id == patient_id,
            Medication.active == True,
        )
        .order_by(
            Medication.created_at.desc()
        )
        .all()
    )


# =========================================================
# MEDICATION SCHEDULES
# =========================================================

@app.post(
    "/api/schedules",
    response_model=ScheduleResponse,
)
def create_schedule(
    data: ScheduleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    medication = (
        db.query(Medication)
        .join(Patient)
        .filter(
            Medication.id == data.medication_id,
            Patient.user_id == user.id,
        )
        .first()
    )

    if not medication:
        raise HTTPException(
            status_code=404,
            detail="Medication not found.",
        )

    schedule = MedicationSchedule(
        medication_id=data.medication_id,
        time=data.time,
        dosage=data.dosage,
        active=True,
    )

    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    return schedule


@app.get(
    "/api/schedules/{patient_id}",
)
def get_patient_schedules(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    patient = (
        db.query(Patient)
        .filter(
            Patient.id == patient_id,
            Patient.user_id == user.id,
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    medications = (
        db.query(Medication)
        .filter(
            Medication.patient_id == patient_id,
            Medication.active == True,
        )
        .all()
    )

    result = []

    today = date.today().isoformat()

    for medication in medications:

        schedules = (
            db.query(MedicationSchedule)
            .filter(
                MedicationSchedule.medication_id
                == medication.id,
                MedicationSchedule.active == True,
            )
            .order_by(
                MedicationSchedule.time.asc()
            )
            .all()
        )

        for schedule in schedules:

            dose = (
                db.query(DoseRecord)
                .filter(
                    DoseRecord.schedule_id
                    == schedule.id,
                    DoseRecord.dose_date
                    == today,
                )
                .first()
            )

            result.append(
                {
                    "id": schedule.id,
                    "schedule_id": schedule.id,
                    "medication_id": medication.id,
                    "medication_name": medication.name,
                    "name": medication.name,
                    "medication_dosage": medication.dosage,
                    "dosage": schedule.dosage,
                    "time": schedule.time,
                    "active": schedule.active,
                    "status": (
                        dose.status
                        if dose
                        else "pending"
                    ),
                    "dose_id": (
                        dose.id
                        if dose
                        else None
                    ),
                }
            )

    result.sort(
        key=lambda item: item.get("time", "")
    )

    return result


# =========================================================
# DOSE RECORDS
# =========================================================

@app.post(
    "/api/doses",
)
def record_dose(
    data: DoseRecordCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    schedule = (
        db.query(MedicationSchedule)
        .join(Medication)
        .join(Patient)
        .filter(
            MedicationSchedule.id
            == data.schedule_id,
            Patient.user_id == user.id,
        )
        .first()
    )

    if not schedule:
        raise HTTPException(
            status_code=404,
            detail="Medication schedule not found.",
        )

    valid_statuses = {
        "taken",
        "missed",
        "pending",
    }

    if data.status.lower() not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid dose status. "
                "Use taken, missed, or pending."
            ),
        )

    existing = (
        db.query(DoseRecord)
        .filter(
            DoseRecord.schedule_id
            == data.schedule_id,
            DoseRecord.dose_date
            == data.dose_date,
        )
        .first()
    )

    if existing:

        existing.status = data.status.lower()

        existing.recorded_at = datetime.utcnow()

        db.commit()
        db.refresh(existing)

        return {
            "id": existing.id,
            "schedule_id": existing.schedule_id,
            "dose_date": existing.dose_date,
            "status": existing.status,
        }

    dose = DoseRecord(
        schedule_id=data.schedule_id,
        dose_date=data.dose_date,
        status=data.status.lower(),
        recorded_at=datetime.utcnow(),
    )

    db.add(dose)
    db.commit()
    db.refresh(dose)

    return {
        "id": dose.id,
        "schedule_id": dose.schedule_id,
        "dose_date": dose.dose_date,
        "status": dose.status,
    }


# =========================================================
# DOSE HISTORY
# =========================================================

@app.get(
    "/api/doses/history",
)
def get_dose_history(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    records = (
        db.query(
            DoseRecord,
            MedicationSchedule,
            Medication,
            Patient,
        )
        .join(
            MedicationSchedule,
            DoseRecord.schedule_id
            == MedicationSchedule.id,
        )
        .join(
            Medication,
            MedicationSchedule.medication_id
            == Medication.id,
        )
        .join(
            Patient,
            Medication.patient_id
            == Patient.id,
        )
        .filter(
            Patient.user_id == user.id
        )
        .order_by(
            DoseRecord.recorded_at.desc()
        )
        .all()
    )

    result = []

    for (
        dose,
        schedule,
        medication,
        patient,
    ) in records:

        result.append(
            {
                "id": dose.id,
                "schedule_id": dose.schedule_id,
                "dose_date": dose.dose_date,
                "status": dose.status,
                "recorded_at": (
                    dose.recorded_at.isoformat()
                    if dose.recorded_at
                    else None
                ),
                "medication_name":
                    medication.name,
                "name":
                    medication.name,
                "dosage":
                    schedule.dosage,
                "patient_id":
                    patient.id,
                "patient_name":
                    patient.full_name,
            }
        )

    return result


# =========================================================
# MEDICATION ADHERENCE
# =========================================================

@app.get(
    "/api/adherence/{patient_id}"
)
def get_adherence(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    patient = (
        db.query(Patient)
        .filter(
            Patient.id == patient_id,
            Patient.user_id == user.id,
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    total = (
        db.query(DoseRecord)
        .join(
            MedicationSchedule,
            DoseRecord.schedule_id
            == MedicationSchedule.id,
        )
        .join(
            Medication,
            MedicationSchedule.medication_id
            == Medication.id,
        )
        .filter(
            Medication.patient_id
            == patient_id
        )
        .count()
    )

    taken = (
        db.query(DoseRecord)
        .join(
            MedicationSchedule,
            DoseRecord.schedule_id
            == MedicationSchedule.id,
        )
        .join(
            Medication,
            MedicationSchedule.medication_id
            == Medication.id,
        )
        .filter(
            Medication.patient_id
            == patient_id,
            DoseRecord.status == "taken",
        )
        .count()
    )

    missed = (
        db.query(DoseRecord)
        .join(
            MedicationSchedule,
            DoseRecord.schedule_id
            == MedicationSchedule.id,
        )
        .join(
            Medication,
            MedicationSchedule.medication_id
            == Medication.id,
        )
        .filter(
            Medication.patient_id
            == patient_id,
            DoseRecord.status == "missed",
        )
        .count()
    )

    adherence = 0

    if total > 0:
        adherence = round(
            (taken / total) * 100,
            1,
        )

    return {
        "patient_id": patient_id,
        "total": total,
        "taken": taken,
        "missed": missed,
        "adherence": adherence,
    }


# =========================================================
# STARTUP
# =========================================================

@app.on_event("startup")
def startup_event():
    print("=" * 60)
    print("MediSafe API started successfully")
    print("API: http://127.0.0.1:8000")
    print("Docs: http://127.0.0.1:8000/docs")
    print("=" * 60)


# =========================================================
# RUN SERVER
# =========================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=False,
    )

