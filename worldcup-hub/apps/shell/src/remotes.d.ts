// Author: Bishakh
// Type stubs so the host compiles against remotes resolved at runtime.
declare module "scoreboard/App" {
  const App: React.ComponentType;
  export default App;
}
declare module "matchCenter/App" {
  // Match-detail remote: accepts the route's match id as a prop (NAVIGATION CONTRACT).
  const App: React.ComponentType<{ matchId?: number }>;
  export default App;
}
declare module "standings/App" {
  const App: React.ComponentType;
  export default App;
}
declare module "news/App" {
  const App: React.ComponentType;
  export default App;
}
