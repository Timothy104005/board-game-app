import Link from "next/link";
import { listProjectRecords } from "@/lib/coreJobs";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const projects = listProjectRecords();

  return (
    <>
      <div className="panel">
        <h1>Board Game Productization MVP</h1>
        <p>Deterministic rulebook -&gt; IR -&gt; compile -&gt; simulate dashboard.</p>
        <Link href="/projects/new">
          <button>Create Project</button>
        </Link>
      </div>

      <div className="panel">
        <h2>Projects</h2>
        {projects.length === 0 ? (
          <p>No projects yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Latest Run</th>
                <th>Updated</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td className="mono">{project.id}</td>
                  <td>{project.name}</td>
                  <td className="mono">{project.latestRunId ?? "-"}</td>
                  <td className="mono">{project.updatedAt}</td>
                  <td>
                    <Link href={`/projects/${project.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
