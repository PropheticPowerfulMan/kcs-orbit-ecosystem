-- Keep EduPay mirror rows attached to the immutable Orbit identity.
ALTER TABLE Parent ADD COLUMN orbitId TEXT;
ALTER TABLE Student ADD COLUMN orbitId TEXT;

CREATE UNIQUE INDEX Parent_schoolId_orbitId_key ON Parent(schoolId, orbitId);
CREATE UNIQUE INDEX Student_schoolId_orbitId_key ON Student(schoolId, orbitId);
