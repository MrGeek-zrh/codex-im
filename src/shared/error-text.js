function extractErrorMessage(error, fallback = "未知错误") {
  const permissionHint = extractFeishuPermissionHint(error);
  if (permissionHint) {
    return permissionHint;
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
}

function formatFailureText(prefix, error, fallback = "未知错误") {
  return `${prefix}：${extractErrorMessage(error, fallback)}`;
}

function extractFeishuPermissionHint(error) {
  const code = error?.response?.data?.code;
  if (code !== 99991672) {
    return "";
  }

  const scopes = extractPermissionScopes(error);
  if (scopes.length) {
    return `飞书应用缺少读取消息权限。需要开通以下任一权限：${scopes.join("、")}`;
  }
  return "飞书应用缺少读取消息权限。需要开通 im:message.history:readonly、im:message:readonly 或 im:message 中的任一权限";
}

function extractPermissionScopes(error) {
  const violations = Array.isArray(error?.response?.data?.error?.permission_violations)
    ? error.response.data.error.permission_violations
    : [];
  const scopes = [];
  for (const violation of violations) {
    const subject = typeof violation?.subject === "string" ? violation.subject.trim() : "";
    if (subject && !scopes.includes(subject)) {
      scopes.push(subject);
    }
  }
  return scopes;
}

module.exports = {
  extractErrorMessage,
  formatFailureText,
};
