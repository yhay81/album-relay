const authForm = document.querySelector("[data-auth-form]");

if (authForm instanceof HTMLFormElement) {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(authForm);
    const submitButton = authForm.querySelector("button[type='submit']");
    const status = authForm.querySelector("[data-auth-status]");
    const signup = authForm.dataset.authForm === "signup";
    const getText = (name) => {
      const value = formData.get(name);
      return typeof value === "string" ? value : "";
    };
    if (submitButton instanceof HTMLButtonElement) submitButton.disabled = true;
    setStatus(status, "");

    try {
      const response = await fetch(`/api/auth/${signup ? "sign-up" : "sign-in"}/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(signup ? { "X-Pilot-Invite": getText("inviteCode") } : {}),
        },
        body: JSON.stringify({
          email: getText("email"),
          password: getText("password"),
          ...(signup ? { name: getText("name") } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "処理を完了できませんでした。");
      window.location.assign(signup ? "/login?registered=1" : "/dashboard");
    } catch (error) {
      setStatus(
        status,
        error instanceof Error ? error.message : "処理を完了できませんでした。",
        true,
      );
    } finally {
      if (submitButton instanceof HTMLButtonElement) submitButton.disabled = false;
    }
  });
}

const signOutButton = document.querySelector("[data-sign-out]");
if (signOutButton instanceof HTMLButtonElement) {
  signOutButton.addEventListener("click", async () => {
    signOutButton.disabled = true;
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      window.location.assign("/");
    } finally {
      signOutButton.disabled = false;
    }
  });
}

for (const uploadForm of document.querySelectorAll("[data-upload-form]")) {
  if (!(uploadForm instanceof HTMLFormElement)) continue;
  uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = uploadForm.querySelector("input[type='file']");
    const status = uploadForm.querySelector("[data-upload-status]");
    const progress = uploadForm.querySelector("[data-upload-progress]");
    const submitButton = uploadForm.querySelector("button[type='submit']");
    const uploadUrl = uploadForm.dataset.uploadUrl;
    if (!(input instanceof HTMLInputElement) || !input.files || !uploadUrl) return;
    const files = [...input.files];
    if (files.length === 0) return;

    if (submitButton instanceof HTMLButtonElement) submitButton.disabled = true;
    if (progress instanceof HTMLProgressElement) {
      progress.classList.remove("hidden");
      progress.value = 0;
    }
    setStatus(status, `${files.length}枚を準備しています…`);

    try {
      let completed = 0;
      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) {
          throw new Error(`${file.name}は20MBを超えています。`);
        }
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          throw new Error(`${file.name}は対応していない形式です。`);
        }

        setStatus(status, `${completed + 1}/${files.length}: ${file.name}を処理中…`);
        const thumbnail = await makeThumbnail(file);
        const body = new FormData();
        body.set("original", file);
        body.set("thumbnail", thumbnail.blob, "thumbnail.jpg");
        body.set("width", String(thumbnail.width));
        body.set("height", String(thumbnail.height));
        const response = await fetch(uploadUrl, { body, method: "POST" });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || `${file.name}を追加できませんでした。`);
        }
        completed += 1;
        if (progress instanceof HTMLProgressElement) {
          progress.value = (completed / files.length) * 100;
        }
      }
      setStatus(status, `${completed}枚を追加しました。`);
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setStatus(
        status,
        error instanceof Error ? error.message : "アップロードを完了できませんでした。",
        true,
      );
      if (submitButton instanceof HTMLButtonElement) submitButton.disabled = false;
    }
  });
}

async function makeThumbnail(file) {
  const image = await createImageBitmap(file, { imageOrientation: "from-image" });
  const originalWidth = image.width;
  const originalHeight = image.height;
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(originalWidth, originalHeight));
  const width = Math.max(1, Math.round(originalWidth * scale));
  const height = Math.max(1, Math.round(originalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("サムネイルを生成できませんでした。");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  image.close();
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("サムネイルを生成できませんでした。"))),
      "image/jpeg",
      0.82,
    );
  });
  return { blob, height: originalHeight, width: originalWidth };
}

function setStatus(element, message, error = false) {
  if (!(element instanceof HTMLElement)) return;
  element.textContent = message;
  element.classList.toggle("error-text", error);
  element.classList.toggle("hidden", !message);
}
