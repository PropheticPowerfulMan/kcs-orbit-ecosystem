# KCS continuity, family documents and annual progression

Targeted components: Nexus API/Web, Jury Web, Orbit API; add the private KCS Classroom SFU and reload the Nexus media proxy route. Other applications and existing gradebook/attendance storage remain untouched.

- Distance learning: Nexus course/enrollment permissions, official school calendar/year, private PDF/image resources, school-owned LiveKit service, cameras/microphones initially off, teacher screen sharing/moderation/readmission, signed connection events separate from official campus attendance. Initial limits: two live rooms, 32 participants each, capped CPU/memory. No automatic recording and no cloud video provider.
- GPA: Grade 1-12 only, existing A=4/B=3/C=2/D=1/F=0 credit weighting; percentage averages unchanged; missing/hidden results excluded, genuine zero retained.
- Teacher assignments: course-isolated server drafts, revision conflict protection, autosave after first save, idempotent publication retries; parents can inspect instructions/completion by day/week/month/year without leaking grades or answer keys.
- Jury: separate family projects view; teachers/organizers retain judge permissions; invitation delivery status, explicit named confirmation and renewable/revocable guest access.
- Parent transcript: same canonical official English document as SuperAdmin.
- Certificates: recipient/document/PDF-bound acknowledgement, provider acceptance distinct from explicit parent confirmation, idempotent receipt and admin history.
- Teacher Reports communication: own active learners/homeroom and linked families; explicit Nexus-only mode creates inbox messages and no email/SMS delivery.
- ST learner email workspace: K3-Grade12 directory; strict email-only mutation, expected-value checks, canonical Orbit update and existing propagation/rollback path. Does not grant credential reset, class/name editing or general registry access.
- Annual progression: a single shared 70% policy, signed approved annual results for the selected year, manual reasoned K3-K5 decisions, automatic year-end review notification after official closure, SuperAdmin approval, stale-preview protection and duplicate-run guard. Missing official results block application; Grade12 graduation keeps the existing archive/access-revocation path. No school placement changes occur merely by deployment.

Deployment requires tested images, backup, targeted migrations and health checks. Private LiveKit keys belong only in /etc/kcs-orbit/classroom.env and classroom.yaml, never Git. RPC/signaling binds only localhost/private gateway; external media ports 7881 TCP and 7882 UDP are separate from the HTTPS proxy. The proxy revalidates current account/enrollment/removal state for every media handshake. Configure a school-hosted TURN relay if a client network blocks direct media ports.

- Principal communication: distinct internal announcements, class/role targeting, drafts/publication/archive, explicit revision-bound reading confirmations and dashboard feeds for linked families; paginated correspondence and report review; own grants/activity view. No public website publishing or external mail is implied by internal announcements.
- Annual placement snapshots are stored before a supervised rollover and reused by canonical report-card PDFs; retrying does not overwrite the original school-year placement.
