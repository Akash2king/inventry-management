/** Fallback while lazy route chunks load (EXE initial bundle stays small). */
export function PageLoading() {
  return (
    <div className="fullscreen-center">
      <div className="spinner" />
    </div>
  );
}
