import { describe, expect, it } from "vitest";
import {
  employeeToFormValues,
  toCreatePayload,
  toUpdatePayload,
} from "@/components/organization/employee-form";
import type { Employee } from "@/types/organization";

const sample: Employee = {
  id: "1",
  companyId: "c1",
  userId: null,
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: null,
  birthDate: null,
  country: null,
  state: null,
  city: null,
  maritalStatus: null,
  childrenCount: null,
  housingType: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  businessUnitId: null,
  areaId: "a1",
  positionId: "p1",
  status: "ACTIVE",
  hireDate: null,
  terminationDate: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
};

describe("employee form mappers", () => {
  it("maps employee to form and create payload", () => {
    const values = employeeToFormValues(sample);
    expect(values.firstName).toBe("Ada");
    expect(values.areaId).toBe("a1");
    const create = toCreatePayload(values);
    expect(create.email).toBe("ada@example.com");
    expect(create.businessUnitId).toBeUndefined();
  });

  it("maps nullables for update payload", () => {
    const values = employeeToFormValues(sample);
    const update = toUpdatePayload(values);
    expect(update.businessUnitId).toBeNull();
    expect(update.birthDate).toBeNull();
  });
});

describe("headcount helper copy", () => {
  it("documents approved positions meaning", () => {
    const helper = "Cantidad de posiciones aprobadas para este cargo.";
    expect(helper.toLowerCase()).toContain("aprobadas");
    expect(helper.toLowerCase()).not.toContain("empleados actuales");
  });
});
