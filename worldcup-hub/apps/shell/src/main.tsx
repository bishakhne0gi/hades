// Author: Bishakh
// Module Federation needs an async boundary before any shared module is used,
// so the real app lives in bootstrap.tsx and we import() it here.
import("./bootstrap");
