const { execSync } = require("child_process");

function createAwsAuth(execModule) {
  const execFn = execModule || execSync;
  let checked = false;

  function ensureAuth(env) {
    if (checked) return;
    checked = true;
    const profile = env.AWS_PROFILE || "bedrock-users";
    if (!/^[a-zA-Z0-9_-]+$/.test(profile)) {
      console.error(`[aws-auth] Invalid AWS profile name: ${profile}`);
      return;
    }
    try {
      execFn(`aws sts get-caller-identity --profile ${profile}`, {
        stdio: "ignore",
        env,
        timeout: 10000,
      });
    } catch {
      try {
        execFn(`aws sso login --profile ${profile}`, {
          stdio: "ignore",
          env,
          timeout: 30000,
        });
      } catch (err) {
        console.error(
          `[aws-auth] AWS SSO login failed for profile "${profile}":`,
          err.message,
        );
      }
    }
  }

  return { ensureAuth };
}

const defaultAuth = createAwsAuth();

module.exports = { ...defaultAuth, createAwsAuth };
