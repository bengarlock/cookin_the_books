// Marks a browser that entered through the public demo link, so an expired demo
// session signs back into the demo instead of stopping at the login form.
// It grants nothing: the backend decides who is a demo user.
export const DEMO_COOKIE_NAME = "cookinTheBooksDemo";

export const DEMO_ENTRY_PATH = "/demo";
