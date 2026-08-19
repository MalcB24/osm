import type {
  BadgeDetails,
  BadgeProgress,
  BadgeProgressMember,
  BadgeRecordMember,
  BadgeRecordsData,
  BadgeRequirement,
  BadgeRequirementMemberState,
} from "../models/index.js";

function getColumnData(
  member: BadgeRecordMember,
): Record<string, string> {
  if (
    member.column_data &&
    !Array.isArray(member.column_data) &&
    typeof member.column_data === "object"
  ) {
    return member.column_data as Record<string, string>;
  }

  return {};
}

function getProgressState(
  note: string,
): BadgeRequirementMemberState {
  const trimmedNote = note.trim();

  if (!trimmedNote) {
    return "Not Complete";
  }

  return trimmedNote.toLowerCase().startsWith("x")
    ? "Has Note"
    : "complete";
}

function getRequirementMember(
  requirement: BadgeRequirement,
  member: BadgeRecordMember,
): BadgeProgressMember {
  const note =
    getColumnData(member)[String(requirement.requirement_id)] ?? "";

  return {
    memberId: member.member_id,
    firstname: member.firstname,
    lastname: member.lastname,
    // fullName: `${member.firstname} ${member.lastname}`,
    // photoGuid: member.photo_guid,
    awarded: member.awarded,
    completed: member.completed,
    awardedDate: member.awardeddate,
    eligible: member.eligible,
    // readOnly: member.read_only,
    note,
    state: getProgressState(note),
  };
}

export function getBadgeProgress(
  records: BadgeRecordsData,
): BadgeProgress {
  const details: BadgeDetails = records.details ?? {
    name: "Unknown badge",
  };
  const members = records.members ?? [];

  return {
    details,
    requirements: (records.requirements ?? []).map(
      (requirement) => ({
        ...requirement,
        members: members.map((member) =>
          getRequirementMember(requirement, member),
        ),
      }),
    ),
  };
}
