export function SessionView({ id }: { id: string }) {
  return (
    <>
      <h1>Session</h1>
      <p>Read-only view of session: {id}</p>
      <div className="stub">Session view — built in phase 6</div>
    </>
  );
}
