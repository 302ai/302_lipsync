"use client";
import { useContext, useState } from "react";
import { AudioSelector, AudioSelectorValueType } from "./audio-selector";
import { Textarea } from "@/components/ui/textarea";
import MP3Player from "@/components/mp3-player";
import HistoryButton from "./history-button";
import { Button } from "@/components/ui/button";
import { useClientTranslation } from "@/hooks/global/use-client-translation";
import { apiKy } from "@/api";
import { env } from "@/env";
import { useAppStore } from "@/stores";
import { createScopedLogger } from "@/utils";
import SKChaseLoading from "@/components/ui/sk-chase-loading";
import {
  getMaxId,
  HistoryItemType,
  save,
} from "@/lib/audio-generate-history-db";
import dayjs from "dayjs";
import { delay } from "@/lib/utils";
import { useLipsyncInfoStore } from "@/stores/use-lipsync-info-store";
import { mainContext } from "@/stores/main-context";
import { ArrowRight } from "lucide-react";
import { MdCleaningServices } from "react-icons/md";
import DownloadButton from "../../download-button";
import { emitter } from "@/utils/mitt";

const GenerateTab = (props: { onClickNext: (newAudioUrl: string) => void }) => {
  const { onClickNext } = props;

  const { t } = useClientTranslation();

  const infoStoreState = useLipsyncInfoStore();

  const { setAudioGenerateData, audioGenerateData } = infoStoreState;

  const maxInputLength = 500;

  const [speakerValue, setSpeakerValue] = useState<AudioSelectorValueType>({
    provider: audioGenerateData.provider,
    lang: audioGenerateData.lang,
    speaker: audioGenerateData.speaker,
  });

  const [audioUrl, setAudioUrl] = useState<string | null>(
    audioGenerateData.audioUrl
  );

  const { loading, setLoading } = useContext(mainContext);

  const [inputValue, setInputValue] = useState<string>(
    audioGenerateData.inputText
  );

  const disabledGenerateButton =
    inputValue.length === 0 || !speakerValue.provider || !speakerValue.speaker;

  const textareaLimitText = `${inputValue.length} / ${maxInputLength}`;

  const uiLang = useAppStore.getState().uiLanguage;

  const logger = createScopedLogger("Home");

  const ajaxGenerateTaskId = async () => {
    if (!speakerValue) return;
    const { provider, speaker } = speakerValue;
    const apiUrl = "302/podcast/async/generate";

    let taskId: string | null = null;
    try {
      const res = await apiKy
        .post(apiUrl, {
          json: {
            speakers: [
              {
                id: 0,
                provider: provider,
                speaker: speaker,
                speed: 1,
              },
            ],
            contents: [
              {
                content: inputValue,
                speaker: 1,
                name: "",
              },
            ],
            useBgm: false,
            autoGenBgm: false,
            bgmPrompt: "",
            bgmVolume: 0,
            uiLang,
            modelName: env.NEXT_PUBLIC_DEFAULT_MODEL_NAME,
          },
        })
        .json<{ task_id: string }>();
      taskId = res.task_id;
    } catch (error) {
      logger.error(error);
    }
    return taskId;
  };

  const ajaxGetAudioUrl = async (taskId: string) => {
    const api = `302/podcast/async/status/${taskId}`;
    let audioUrl: string | null = null;
    // try 100 times
    const maxTryies = 100;
    for (let index = 0; index < maxTryies; index++) {
      try {
        const res = await apiKy.get(api).json<{
          result: { content: string; progress: number };
          status: string;
        }>();

        if (typeof res.status !== "undefined" && res.status === "fail") {
          logger.error(res.result);
          break;
        }
        if (res.result.progress === 100) {
          audioUrl = res.result.content;
          break;
        }
      } catch (error) {
        logger.error(error);
        break;
      }
      // pause for 3s
      await delay(3000);
      continue;
    }

    return audioUrl;
  };

  const doGenerateAudioUrl = async () => {
    const taskId = await ajaxGenerateTaskId();
    if (!taskId) {
      emitter.emit("ToastError", {
        code: -1,
        message: t("home:audio_tab.generate.send_generate_error"),
      });
      return null;
    }
    const audioUrl = await ajaxGetAudioUrl(taskId);
    if (!audioUrl) {
      // emitter.emit("ToastError", {
      //   code: -1,
      //   message: t("home:audio_tab.generate.get_generate_audio_error"),
      // });
      return null;
    }
    return audioUrl;
  };

  const onClickGenerate = async () => {
    setLoading(true);
    const newAudioUrl = await doGenerateAudioUrl();
    setLoading(false);
    if (!newAudioUrl || !speakerValue) {
      return;
    }
    setAudioUrl(newAudioUrl);
    const historyItem: HistoryItemType = {
      id: (await getMaxId()) + 1 + "",
      audioUrl: newAudioUrl,
      inputText: inputValue,
      provider: speakerValue.provider,
      lang: speakerValue.lang,
      speaker: speakerValue.speaker,
      createdAt: dayjs().valueOf(),
      updatedAt: dayjs().valueOf(),
    };
    await save(historyItem);
    setAudioGenerateData(historyItem);
    emitter.emit("ToastSuccess", {
      code: -1,
      message: t("home:audio_tab.generate.generate_success"),
    });
  };

  const onClickHistoryItem = (historyItem: HistoryItemType) => {
    setAudioGenerateData(historyItem);
    setAudioUrl(historyItem.audioUrl);
    setInputValue(historyItem.inputText);
    setSpeakerValue({
      provider: historyItem.provider,
      lang: historyItem.lang,
      speaker: historyItem.speaker,
    });
  };

  return (
    <>
      <div className="relative z-0 flex flex-1 flex-col">
        <div className="z-10 box-border flex flex-1 flex-col pt-4 md:max-h-96">
          <div className="relative flex flex-1 flex-col">
            <div className="md:text-md absolute bottom-2 right-3 text-sm text-gray-400">
              {textareaLimitText}
            </div>
            <Textarea
              maxLength={maxInputLength}
              value={inputValue}
              className="flex-1 resize-none pb-8"
              placeholder={t("home:audio_tab.generate.textarea_placeholder")}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>
          <div className="mt-2 flex w-full flex-row flex-wrap gap-2">
            <AudioSelector
              value={speakerValue}
              onChange={(newValue) => setSpeakerValue(newValue)}
            />
          </div>
          <div className="mt-2 flex w-full flex-row">
            <MP3Player audioSrc={audioUrl || ""} />
          </div>
          <div className="flex-row"></div>
        </div>
        <div className="mt-2 flex flex-row flex-wrap justify-between gap-2">
          <HistoryButton
            className="flex-1 gap-2 md:flex-none"
            onClickHistoryItem={(newItem) => onClickHistoryItem(newItem)}
          />
          <Button
            className="flex-1 gap-2 md:flex-none"
            disabled={disabledGenerateButton}
            variant="secondary"
            onClick={() => setInputValue("")}
          >
            <MdCleaningServices className="h-4 w-4" />
            {t("home:audio_tab.generate.clear_input_button_text")}
          </Button>
          <Button
            className="flex-1 md:flex-none"
            disabled={disabledGenerateButton}
            variant={disabledGenerateButton ? "secondary" : "default"}
            onClick={() => onClickGenerate()}
          >
            {t("home:audio_tab.generate.generate_button_text")}
          </Button>
          <DownloadButton className="flex-1 md:flex-none" fileUrl={audioUrl} />
        </div>
        <div className="mt-2 flex flex-row justify-center">
          <Button
            className="gap-2"
            disabled={!audioUrl}
            onClick={() => audioUrl && onClickNext(audioUrl)}
          >
            <ArrowRight className="h-4 w-4" />
            {t("home:audio_tab.next_step_button_text")}
          </Button>
        </div>
      </div>
      <SKChaseLoading loading={loading} />
    </>
  );
};
export default GenerateTab;
