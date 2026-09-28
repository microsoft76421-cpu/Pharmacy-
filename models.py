from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Boolean
)

from sqlalchemy.orm import relationship
from datetime import datetime

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    full_name = Column(
        String(150),
        nullable=False
    )

    email = Column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    role = Column(
        String(50),
        default="patient",
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    patients = relationship(
        "Patient",
        back_populates="user",
        cascade="all, delete-orphan"
    )


class Patient(Base):
    __tablename__ = "patients"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    full_name = Column(
        String(150),
        nullable=False
    )

    date_of_birth = Column(
        String(50),
        nullable=True
    )

    phone = Column(
        String(50),
        nullable=True
    )

    emergency_contact = Column(
        String(150),
        nullable=True
    )

    emergency_phone = Column(
        String(50),
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    user = relationship(
        "User",
        back_populates="patients"
    )

    medications = relationship(
        "Medication",
        back_populates="patient",
        cascade="all, delete-orphan"
    )


class Medication(Base):
    __tablename__ = "medications"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    patient_id = Column(
        Integer,
        ForeignKey("patients.id"),
        nullable=False
    )

    name = Column(
        String(150),
        nullable=False
    )

    dosage = Column(
        String(100),
        nullable=False
    )

    frequency = Column(
        String(100),
        nullable=False
    )

    instructions = Column(
        String(500),
        nullable=True
    )

    quantity = Column(
        Integer,
        default=0
    )

    active = Column(
        Boolean,
        default=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    patient = relationship(
        "Patient",
        back_populates="medications"
    )

class MedicationSchedule(Base):
    __tablename__ = "medication_schedules"

    id = Column(Integer, primary_key=True, index=True)

    medication_id = Column(
        Integer,
        ForeignKey("medications.id"),
        nullable=False
    )

    time = Column(
        String(10),
        nullable=False
    )

    dosage = Column(
        String(100),
        nullable=False
    )

    active = Column(
        Boolean,
        default=True
    )

    medication = relationship(
        "Medication",
        backref="schedules"
    )


class DoseRecord(Base):
    __tablename__ = "dose_records"

    id = Column(Integer, primary_key=True, index=True)

    schedule_id = Column(
        Integer,
        ForeignKey("medication_schedules.id"),
        nullable=False
    )

    dose_date = Column(
        String(20),
        nullable=False
    )

    status = Column(
        String(20),
        nullable=False
    )

    recorded_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    schedule = relationship(
        "MedicationSchedule",
        backref="dose_records"
    )