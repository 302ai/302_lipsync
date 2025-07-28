"use client";

import { Button } from "@/components/ui/button";
import { useClientTranslation } from "@/hooks/global/use-client-translation";
// import HistoryButton from "./history-button";
import { useContext, useEffect, useState } from "react";
import { apiKy } from "@/api";
import { createScopedLogger } from "@/utils";
import { delay } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { useLipsyncInfoStore } from "@/stores/use-lipsync-info-store";
import {
  getMaxId,
  HistoryItemType,
  save,
} from "@/lib/video-generate-history-db";
import dayjs from "dayjs";
import { mainContext } from "@/stores/main-context";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import DownloadButton from "../download-button";
import useHedraUploadImage from "@/hooks/use-hedra-upload-image";
import { emitter } from "@/utils/mitt";
import useAjaxPost from "@/hooks/use-ajax-post";

/**
 * Video Genneration Pannel
 * @returns
 */
const VideoGennerationPannel = (props: {
  audioUrl: string | null;
  imageUrl: string | null;
  videoRatio: string;
  onClickBack: () => void;
}) => {
  const { audioUrl, imageUrl, videoRatio, onClickBack } = props;

  const { generateVideo, setGenerateVideo, setLoading, reset } =
    useContext(mainContext);

  const { videoUrl, setVideoUrl } = useLipsyncInfoStore();

  const { t } = useClientTranslation();

  const logger = createScopedLogger("Home");

  const [progress, setProgress] = useState(100);

  const { ajaxUploadImageToHedra } = useHedraUploadImage();

  const { doAjax: ajaxUploadAudioToHedraNew } = useAjaxPost(
    apiKy,
    "hedra/api/v1/audio"
  );

  const ajaxGetVideoUrl = async (
    jobId: string,
    updateProgress: (percentage: number) => void
  ) => {
    const api = `hedra/api/v1/projects/${jobId}`;
    let videoUrl: string | null = null;
    // try 100 times
    const maxTryies = 100;
    for (let index = 0; index < maxTryies; index++) {
      let thisRoundProgress = 0;
      try {
        // const res = await apiKy.get(api).json<{
        const res = await apiKy.get(api).json<{
          progress: number;
          videoUrl: string;
        }>();

        thisRoundProgress = res.progress * 100;

        if (res.videoUrl && res.videoUrl !== "") {
          videoUrl = res.videoUrl;
          break;
        }
      } catch (error) {
        logger.error(error);
        break;
      }
      // update progress state
      updateProgress(thisRoundProgress - 0.03);
      // pause for 3s
      await delay(3000);
      continue;
    }

    return videoUrl;
  };

  const ajaxGenerateVideoJobId = async (
    imageUrl: string,
    audioUrl: string,
    aspectRatio: string
  ) => {
    if (!imageUrl || !audioUrl) {
      emitter.emit("ToastError", {
        code: -1,
        message: t("home:generation_tab.no_source_error"),
      });
      return;
    }
    const url = "hedra/api/v1/characters";
    let result: string | null = null;
    try {
      const res = await apiKy
        .post(url, {
          json: {
            avatarImage: imageUrl,
            audioSource: "audio",
            voiceUrl: audioUrl,
            aspectRatio,
          },
        })
        .json<{ jobId: string }>();
      result = res.jobId;
    } catch (error) {
      logger.error(error);
    }
    return result;
  };

  const getFileNameFromUrl = (url: string) => {
    const urlObject = new URL(url);
    const pathName = urlObject.pathname;
    return pathName.split("/").pop(); // 获取最后一部分，即文件名
  };

  const ajaxDownloadFile = async (fileUrl: string, fileName: string) => {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    return new File([blob], fileName, { type: blob.type });
  };

  const ajaxUploadAudioToHedra = async (file: File) => {
    const form = new FormData();
    form.append("file", file);

    const { result: resultRaw, errorHint } = await ajaxUploadAudioToHedraNew<{
      url: string;
    }>({
      body: form,
    });

    const result = resultRaw ? resultRaw.url : null;

    return {
      result,
      errorHint,
    };
  };

  const stopAction = () => {
    setProgress(100);
    setLoading(false);
    setGenerateVideo(false);
  };

  const doAction = async () => {
    if (!audioUrl || !imageUrl) {
      stopAction();
      return;
    }
    const audioFileName = getFileNameFromUrl(audioUrl);
    if (!audioFileName) {
      stopAction();
      return;
    }
    const imageFileName = getFileNameFromUrl(imageUrl);
    if (!imageFileName) {
      stopAction();
      return;
    }
    setVideoUrl(null);
    setProgress(0);
    setLoading(true);

    const audioFile = await ajaxDownloadFile(audioUrl, audioFileName);

    const imageFile = await ajaxDownloadFile(imageUrl, imageFileName);

    if (!audioFile || !imageFile) {
      stopAction();
      return;
    }

    const { result: audioHedraUrl, errorHint } =
      await ajaxUploadAudioToHedra(audioFile);

    if (!audioHedraUrl) {
      // sync file to hedra failed
      if (errorHint) {
        emitter.emit("ToastError", {
          code: -1,
          message: t("home:generation_tab.generate_audio_error"),
        });
      }
      stopAction();
      return;
    }

    const imageHedraUrl = await ajaxUploadImageToHedra(imageFile, videoRatio);

    if (!imageHedraUrl) {
      // sync file to hedra failed
      stopAction();
      return;
    }

    const videoId = await ajaxGenerateVideoJobId(
      imageHedraUrl,
      audioHedraUrl,
      videoRatio
    );
    // const videoId = "1";
    if (!videoId) {
      emitter.emit("ToastError", {
        code: -1,
        message: t("home:generation_tab.generate_error"),
      });
      stopAction();
      return;
    }
    const videoUrl = await ajaxGetVideoUrl(videoId, (newProgress) => {
      setProgress(newProgress);
    });

    if (!videoUrl) {
      emitter.emit("ToastError", {
        code: -1,
        message: t("home:generation_tab.generate_error"),
      });
      stopAction();
      return;
    }
    emitter.emit("ToastSuccess", {
      code: -1,
      message: t("home:generation_tab.generate_success"),
    });
    if (progress! == 100) {
      stopAction();
    }
    setVideoUrl(videoUrl);
    const historyItem: HistoryItemType = {
      id: (await getMaxId()) + 1 + "",
      url: videoUrl,
      imgUrl: imageUrl,
      createdAt: dayjs().valueOf(),
      updatedAt: dayjs().valueOf(),
    };
    await save(historyItem);
  };

  useEffect(() => {
    if (!generateVideo) {
      return;
    }
    doAction();
    // run just once when loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generateVideo]);
  return (
    <>
      <div className="relative mx-3 flex flex-1 flex-col">
        {progress === 100 ? (
          <>
            {videoUrl ? (
              <div className="mx-auto my-0 flex w-10/12 flex-col justify-center overflow-hidden rounded-2xl border border-gray-300">
                <video controls={true} className="block" src={videoUrl}></video>
              </div>
            ) : (
              <div className="mt-4 flex max-h-full flex-1 flex-grow flex-col justify-center gap-2 overflow-hidden rounded-2xl border border-gray-300 text-center text-sm text-gray-400">
                <div className="">
                  {t("home:generation_tab.hint_text_no_video")}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mt-4 flex max-h-full flex-1 flex-grow flex-col justify-center gap-2 overflow-hidden rounded-2xl border border-gray-300 text-center text-sm text-gray-400">
              <div className="">{t("home:generation_tab.hint_text_1")}</div>
              <div className="px-8">
                <Progress value={progress} />
              </div>
              <div className="">{t("home:generation_tab.hint_text_2")}</div>
            </div>
          </>
        )}
        <div className="mb-2 mt-2 flex flex-row justify-center gap-4">
          <Button
            className="gap-2"
            disabled={progress !== 100}
            variant="secondary"
            onClick={() => onClickBack()}
          >
            <ArrowLeft className="size-4" />
            {t("home:generation_tab.back_button")}
          </Button>
          <Button
            className="gap-2"
            disabled={progress !== 100}
            variant="secondary"
            onClick={() => reset()}
          >
            <Plus className="size-4" />
            {t("home:generation_tab.make_new_button")}
          </Button>
          <DownloadButton
            className="hidden md:inline-flex"
            fileUrl={videoUrl}
            disabled={progress !== 100}
          />
          <Button
            disabled={progress !== 100 || !imageUrl || !imageUrl}
            onClick={() => doAction()}
            className="hidden gap-2 md:inline-flex"
            variant="secondary"
          >
            <Loader2 className={`size-4 ${progress < 100 && "animate-spin"}`} />
            {t("home:generation_tab.regenerate_button")}
          </Button>
        </div>
        <div className="mb-2 mt-2 flex flex-row justify-center gap-4 md:hidden">
          <DownloadButton fileUrl={videoUrl} disabled={progress !== 100} />
          <Button
            disabled={progress !== 100 || !imageUrl || !imageUrl}
            onClick={() => doAction()}
            className="gap-2"
            variant="secondary"
          >
            <Loader2 className={`size-4 ${progress < 100 && "animate-spin"}`} />
            {t("home:generation_tab.regenerate_button")}
          </Button>
        </div>
      </div>
    </>
  );
};
export default VideoGennerationPannel;
