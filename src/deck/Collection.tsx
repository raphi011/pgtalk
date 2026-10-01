import { talks } from "./talks.js";

export function Collection() {
  return (
    <main className="collection">
      <h1>Talks</h1>
      <p>Choose a talk.</p>
      <ul>
        {talks.map((talk) => (
          <li key={talk.id}>
            <a href={`#/${talk.id}/${talk.sessions[0]}/0/0`}>{talk.title}</a>
            <span>{talk.sessions.length} {talk.sessions.length === 1 ? "session" : "sessions"}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
