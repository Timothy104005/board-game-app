import Link from "next/link";
import { createProjectAction } from "./actions";

export const dynamic = "force-dynamic";

export default function NewProjectPage() {
  return (
    <>
      <div className="panel">
        <h1>Create Project</h1>
        <p>Paste rulebook text or upload a .txt file. Uploaded text wins when both are provided.</p>
        <p>
          <Link href="/">Back to Home</Link>
        </p>
      </div>

      <form action={createProjectAction} className="panel">
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="name">Project Name</label>
          <input id="name" name="name" type="text" defaultValue="Untitled Project" required />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label htmlFor="seedDefault">Default Seed</label>
          <input id="seedDefault" name="seedDefault" type="text" defaultValue="42" required />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label htmlFor="rulebookText">Rulebook Text</label>
          <textarea
            id="rulebookText"
            name="rulebookText"
            rows={16}
            placeholder="Paste game rulebook text here..."
            required
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label htmlFor="rulebookFile">Upload .txt</label>
          <input id="rulebookFile" name="rulebookFile" type="file" accept=".txt,text/plain" />
        </div>

        <button type="submit">Create Project</button>
      </form>
    </>
  );
}
