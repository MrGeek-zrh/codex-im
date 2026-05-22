const test = require("node:test");
const assert = require("node:assert/strict");

const { onFeishuTextEvent } = require("../src/app/dispatcher");

test("sends pure image messages to codex", async () => {
  let sentNormalized = null;
  let resolveWorkspaceCalled = false;
  let dispatchTextCommandCalled = false;
  const runtime = {
    config: {
      defaultWorkspaceId: "default",
    },
    dispatchTextCommand: async () => {
      dispatchTextCommandCalled = true;
      return false;
    },
    resolveWorkspaceContext: async () => {
      resolveWorkspaceCalled = true;
      return {
        bindingKey: "binding",
        workspaceRoot: "/tmp/project",
      };
    },
    resolveWorkspaceThreadState: async () => ({
      threadId: "thread_image",
    }),
    setPendingBindingContext() {},
    setPendingThreadContext() {},
    addPendingReaction: async () => {},
    ensureThreadAndSendMessage: async ({ normalized }) => {
      sentNormalized = normalized;
      return "thread_image";
    },
    movePendingReactionToThread() {},
    clearPendingReactionForBinding: async () => {},
    sendInfoCardMessage: async () => {
      throw new Error("pure image messages should not receive a hint");
    },
  };

  await onFeishuTextEvent(runtime, {
    message: {
      message_type: "image",
      content: JSON.stringify({ image_key: "img_only" }),
      chat_id: "oc_image",
      message_id: "om_image",
    },
    sender: {
      sender_id: {
        open_id: "ou_image",
      },
    },
  });

  assert.equal(dispatchTextCommandCalled, false);
  assert.equal(resolveWorkspaceCalled, true);
  assert.equal(sentNormalized.messageType, "image_only");
  assert.equal(sentNormalized.text, "");
  assert.deepEqual(sentNormalized.images, [
    {
      imageKey: "img_only",
      sourceType: "image",
    },
  ]);
});

test("treats mixed slash text and image messages as codex input", async () => {
  let sentNormalized = null;
  let dispatchTextCommandCalled = false;
  const runtime = {
    config: {
      defaultWorkspaceId: "default",
    },
    dispatchTextCommand: async () => {
      dispatchTextCommandCalled = true;
      return true;
    },
    resolveWorkspaceContext: async () => ({
      bindingKey: "binding",
      workspaceRoot: "/tmp/project",
    }),
    resolveWorkspaceThreadState: async () => ({
      threadId: "thread_mixed",
    }),
    setPendingBindingContext() {},
    setPendingThreadContext() {},
    addPendingReaction: async () => {},
    ensureThreadAndSendMessage: async ({ normalized }) => {
      sentNormalized = normalized;
      return "thread_mixed";
    },
    sendInfoCardMessage: async ({ text }) => {
      throw new Error(`unexpected info card: ${text}`);
    },
    movePendingReactionToThread() {},
    clearPendingReactionForBinding: async () => {},
  };

  await onFeishuTextEvent(runtime, {
    message: {
      message_type: "post",
      content: JSON.stringify({
        content: [
          [
            { tag: "text", text: "/codex where" },
            { tag: "img", image_key: "img_post" },
          ],
        ],
      }),
      chat_id: "oc_mixed",
      message_id: "om_mixed",
    },
    sender: {
      sender_id: {
        open_id: "ou_mixed",
      },
    },
  });

  assert.equal(dispatchTextCommandCalled, false);
  assert.equal(sentNormalized.messageType, "mixed");
  assert.equal(sentNormalized.text, "/codex where");
  assert.deepEqual(sentNormalized.images, [
    {
      imageKey: "img_post",
      sourceType: "post",
    },
  ]);
});

test("returns a readable hint when inbound file download lacks feishu message scope", async () => {
  let sentInfoText = "";
  const permissionError = new Error("Request failed with status code 400");
  permissionError.response = {
    status: 400,
    data: {
      code: 99991672,
      msg: "Access denied. One of the following scopes is required: [im:message.history:readonly, im:message:readonly, im:message]",
      error: {
        permission_violations: [
          { type: "action_scope_required", subject: "im:message.history:readonly" },
          { type: "action_scope_required", subject: "im:message:readonly" },
          { type: "action_scope_required", subject: "im:message" },
        ],
      },
    },
  };

  const runtime = {
    config: {
      defaultWorkspaceId: "default",
    },
    dispatchTextCommand: async () => false,
    resolveWorkspaceContext: async () => ({
      bindingKey: "binding",
      workspaceRoot: "/tmp/project",
    }),
    resolveWorkspaceThreadState: async () => ({
      threadId: "thread_file",
    }),
    setPendingBindingContext() {},
    setPendingThreadContext() {},
    addPendingReaction: async () => {},
    ensureThreadAndSendMessage: async () => {
      throw permissionError;
    },
    movePendingReactionToThread() {},
    clearPendingReactionForBinding: async () => {},
    sendInfoCardMessage: async ({ text }) => {
      sentInfoText = text;
    },
  };

  await assert.rejects(
    () => onFeishuTextEvent(runtime, {
      message: {
        message_type: "file",
        content: JSON.stringify({
          file_key: "file_v3_test",
          file_name: "build.log",
        }),
        chat_id: "oc_file",
        message_id: "om_file",
      },
      sender: {
        sender_id: {
          open_id: "ou_file",
        },
      },
    }),
    /Request failed with status code 400/
  );

  assert.match(sentInfoText, /飞书应用缺少读取消息权限/);
  assert.match(sentInfoText, /im:message\.history:readonly/);
  assert.match(sentInfoText, /im:message:readonly/);
  assert.match(sentInfoText, /im:message/);
});
