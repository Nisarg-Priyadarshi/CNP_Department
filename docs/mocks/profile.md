# Profile — what is derived or client-side

The profile area keeps the existing contracts: `GET /auth/me` on boot, `PATCH /users/profile` on
save and `POST /users/profile-image` on upload. Field names, required attributes, the `FormData`
key (`image`), the save/cancel rules and the messages the API returns are untouched.

Everything below is computed from the response those calls already return.

| What | Where | Why it is client-side today | Suggested API |
|---|---|---|---|
| Completeness ring, "N of 5", tick scale and the missing-field marks | Identity plate, strength strip | No completeness field exists. Derived from `name`, `department`, `phone`, plus `universityId` and `semester` for students — the exact predicate behind `isProfileComplete()`. Marked `// MOCK:` in `Profile.tsx` | Return `completeness: { percent, missing[] }` (or a required-field list) from `GET /auth/me` so the rule lives in one place |
| Live completeness while editing | Strength strip above the open sheet | Reads the unsaved `formData` so the gauge answers the fields directly above it. Presentation only — nothing is persisted until save | Not needed |
| "Member since" date plate | Identity plate, right side | `createdAt` is returned by Mongoose on the user document but is not in the documented `User` shape or `frontend/src/types`. The plate is omitted when the field is missing. Marked `// MOCK:` | Add `createdAt` to the documented user payload and to the `User` type |
| Live identity preview while editing | Identity plate | Reads the unsaved `formData` (falling back to the saved user) so the name, role and fact rail reflect typing; it is a preview, not a persisted value | Not needed |
| Photo state ("Uploaded" / "Monogram") | Account strip | Derived from the presence of `profileImage`; there is no separate media record | Not needed |
| Copy affordances and the "Email address copied" / "Phone number copied" announcement | Contact block | Client clipboard only. Prospective enhancement: the `mailto:` / `tel:` links remain and failures are silent. The phone copy is new; it does not replace the link | Not needed |
| Initials monogram | Identity plate, UserDisplay, UserSelect | Derived from the name's first two words when `profileImage` is null. `profileImage` itself comes from the API | Not needed |
| Role label and role mark | Plate, Account strip, UserDisplay, UserSelect | The API returns the `role` key; the label and the kind glyph are a local map (`pages/Profile/labels.ts`). Read-only vocabulary | Not needed |
| Missing-field marks opening the sheet at that field | Strength strip → edit sheet | Client focus management only. It reads the same required-field list as the gauge; no extra request | Not needed |

## Client-side presentation decisions (no API impact)

- **Read mode is the default, including for an incomplete profile.** The identity plate shows the
  holes (dashed marks) and the ring, and the primary action is "Edit profile". Previously an
  incomplete profile opened straight into the form and could not be closed, which left the strength
  marks unreachable. Validation, the required attributes and the "Cancel only when complete" rule
  are unchanged.
- **The incomplete-profile notice was removed.** Its sentence ("Profile incomplete. … are still
  needed") is now the ring, the "N of 5" ratio and the named marks in the strength strip. Nothing
  about the requirement set changed.

## Verification-only substitutes

Screenshots of the incomplete state (80%, one missing "Phone number" mark) were produced with
Puppeteer request interception on `GET /auth/me` (a null `phone`). That response is **not** shipped
code and no seed record was written. The real page renders from the API.

`UserDisplay` is not imported by any page in the current tree; it was verified on a temporary,
unrouted preview page (`frontend/__person-preview.html`, `src/pages/Profile/__preview.tsx`) that
rendered real `GET /users?role=student` records plus two deliberately partial copies of them, to
confirm it does not throw on a populated document missing a field. Both files were deleted after
the screenshot. `UserSelect` is imported by `ClubManagement`, `ProjectManagement` and
`ProjectMentors`; it was checked inside the club "Add member" and "Coordinator" modals.
