import Elysia from "elysia";
import { auth } from "./service";

const authRoutePlugin = new Elysia({ name: "auth-route" }).mount(auth.handler);

const authPlugin = new Elysia({ name: "auth" }).macro({
	auth: {
		async resolve({ status, request: { headers } }) {
			const session = await auth.api.getSession({ headers });
			if (!session) return status(401);

			return {
				user: session.user,
				session: session.session,
				role: session.user.role ?? "user",
			};
		},
	},
});

export { auth, authPlugin, authRoutePlugin };
