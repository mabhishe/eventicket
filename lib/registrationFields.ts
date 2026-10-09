/**
 * Camp/registration field modules: per-event toggles (off/optional/required)
 * for emergency contact, medical/allergy notes, authorized pickup, and
 * waiver/consent — plus a one-click Camp preset. Stored as JSON in
 * Event.registrationFields (null = everything off).
 *
 * Basic modules are free for all plans. The custom per-ticket field builder
 * and waiver template library are Pro (later, not in v1).
 */

export type FieldMode = "off" | "optional" | "required";

export type RegistrationFields = {
  emergencyContact: FieldMode;
  medicalNotes: FieldMode;
  pickupAuth: FieldMode;
  waiver: FieldMode;
  waiverText: string;
};

export const REGISTRATION_FIELDS_DEFAULT: RegistrationFields = {
  emergencyContact: "off",
  medicalNotes: "off",
  pickupAuth: "off",
  waiver: "off",
  waiverText: "",
};

/** One-click preset for camps/classes: the standard required set. */
export const CAMP_PRESET: RegistrationFields = {
  emergencyContact: "required",
  medicalNotes: "required",
  pickupAuth: "required",
  waiver: "required",
  waiverText: "",
};

const MODES: FieldMode[] = ["off", "optional", "required"];

function isMode(v: unknown): v is FieldMode {
  return typeof v === "string" && (MODES as string[]).includes(v);
}

/** Parse the stored JSON; unknown/missing values fall back to defaults. */
export function parseRegistrationFields(
  raw: string | null | undefined
): RegistrationFields {
  if (!raw) return { ...REGISTRATION_FIELDS_DEFAULT };
  try {
    const p = JSON.parse(raw) as Partial<RegistrationFields>;
    return {
      emergencyContact: isMode(p.emergencyContact)
        ? p.emergencyContact
        : "off",
      medicalNotes: isMode(p.medicalNotes) ? p.medicalNotes : "off",
      pickupAuth: isMode(p.pickupAuth) ? p.pickupAuth : "off",
      waiver: isMode(p.waiver) ? p.waiver : "off",
      waiverText: typeof p.waiverText === "string" ? p.waiverText : "",
    };
  } catch {
    return { ...REGISTRATION_FIELDS_DEFAULT };
  }
}

export function serializeRegistrationFields(f: RegistrationFields): string {
  return JSON.stringify({
    emergencyContact: f.emergencyContact,
    medicalNotes: f.medicalNotes,
    pickupAuth: f.pickupAuth,
    waiver: f.waiver,
    waiverText: f.waiverText,
  });
}

/** True when at least one module is enabled. */
export function hasAnyRegistrationField(f: RegistrationFields): boolean {
  return (
    f.emergencyContact !== "off" ||
    f.medicalNotes !== "off" ||
    f.pickupAuth !== "off" ||
    f.waiver !== "off"
  );
}

export const REGISTRATION_FIELD_LABELS: Record<
  Exclude<keyof RegistrationFields, "waiverText">,
  string
> = {
  emergencyContact: "Emergency contact",
  medicalNotes: "Medical / allergy notes (per child)",
  pickupAuth: "Authorized pickup",
  waiver: "Waiver / consent",
};
