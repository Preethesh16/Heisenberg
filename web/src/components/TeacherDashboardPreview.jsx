import { copy } from "../utils/copy";

// One static image. Never live data — the dashboard is a slide, not a feature.
export default function TeacherDashboardPreview() {
  return (
    <figure className="dashboard-preview">
      <img
        src="/teacher-dashboard.svg"
        alt="Teacher dashboard preview"
        onError={(e) => { e.currentTarget.closest("figure").style.display = "none"; }}
      />
      <figcaption>{copy.defeat.dashboardNote}</figcaption>
    </figure>
  );
}
