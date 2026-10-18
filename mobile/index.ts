// App entry. perfBoot must stay first: it marks when JS starts executing, before
// expo-router and the route graph are evaluated (cold-start breakdown,
// docs/log/cold-start.md).
import "./utils/perfBoot";
import "expo-router/entry";
