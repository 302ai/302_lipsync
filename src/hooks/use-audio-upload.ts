import { fileKy, apiKy } from "@/api";
import { createScopedLogger, Logger } from "@/utils";
import { useState } from "react";
import useAjaxPost from "./use-ajax-post";

function isAudioFile(filename: string) {
  const lowerCaseFilename = filename.toLowerCase();
  return (
    lowerCaseFilename.endsWith(".mp3") || lowerCaseFilename.endsWith(".wav")
  );
}

const useVideoUpload = () => {
  const { doAjax } = useAjaxPost(apiKy, "302/vt/video/extract_audio");

  const videoUpload = async (file: File) => {
    const form = new FormData();
    form.append("file", file);

    const { result: resultRaw, errorHint } = await doAjax<{ url: string }>({
      body: form,
    });

    const result = resultRaw ? resultRaw.url : null;

    return {
      result,
      errorHint,
    };
  };
  return {
    videoUpload,
  };
};

// const videoUpload = async (file: File, logger: Logger) => {
//   let result: string | null = null;
//   const url = "video/extract_audio";
//   const form = new FormData();
//   form.append("file", file);
//   try {
//     const res = await dialogueKy
//       .post(url, {
//         body: form,
//       })
//       .json<{ url: string }>();
//     result = res.url;
//   } catch (error) {
//     logger.error(error);
//   }
//   return result;
// };

const auidioUpload = async (file: File, logger: Logger) => {
  let result: string | null = null;
  const url = "gpt/api/upload/gpt/image";
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fileKy
      .post(url, {
        body: form,
      })
      .json<{ data: { url: string } }>();
    result = res.data.url;
  } catch (error) {
    logger.error(error);
  }
  return result;
};

const useAudioUpload = () => {
  const logger = createScopedLogger("Home");
  const [loading, setLoading] = useState(false);

  const { videoUpload } = useVideoUpload();

  const upload = async (file: File) => {
    setLoading(true);
    const fileName = file.name;
    let result: string | null = null;
    let errorHint = true;
    if (isAudioFile(fileName)) {
      result = await auidioUpload(file, logger);
    } else {
      const resultRaw = await videoUpload(file);
      result = resultRaw.result;
      errorHint = resultRaw.errorHint;
    }
    setLoading(false);
    return {
      result,
      errorHint,
    };
  };

  return {
    loading,
    upload,
  };
};
export default useAudioUpload;
