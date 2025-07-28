"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClientTranslation } from "@/hooks/global/use-client-translation";
import {
  AudioVoiceOptionItem,
  AudioVoiceLangOptionItem,
  useAudioVoiceOptions,
} from "@/hooks/use-audio-voice-options";
import { createScopedLogger } from "@/utils";
import { useEffect, useState } from "react";
import { useIsAuthed } from "@/hooks/global/use-is-authed";
import { useAppStore } from "@/stores";
import toast from "react-hot-toast";

/**
 * Component Value Type
 */
interface AudioSelectorValueType {
  provider: string;
  lang: string;
  speaker: string;
}

const getSelectItemsChildren = (
  options: AudioVoiceLangOptionItem[],
  langValue: string
) => {
  const result = options.find((item) => item.value === langValue);
  if (!result) return [];
  return result.children;
};

const getSelectItemsLangChildren = (
  options: AudioVoiceOptionItem[],
  providerValue: string
) => {
  const result = options.find((item) => item.value === providerValue);
  if (!result) return [];
  return result.children;
};

const AudioSelector = (props: {
  value: AudioSelectorValueType;
  onChange: (newValue: AudioSelectorValueType) => void;
}) => {
  const { value: valueParent, onChange: onChangeParent } = props;

  const { t } = useClientTranslation();

  const logger = createScopedLogger("Home");

  const [options, setOptions] = useState<AudioVoiceOptionItem[]>([]);

  const { ajaxGetVoiceModel } = useAudioVoiceOptions();

  const isAuthed = useIsAuthed();
  const _hasHydrated = useAppStore((state) => state._hasHydrated);

  const uiLang = "all";

  const { provider, lang, speaker } = valueParent || {
    provider: "",
    speaker: "",
    lang: "",
  };

  const langOptions = getSelectItemsLangChildren(options, provider);

  const speakerOptions = getSelectItemsChildren(langOptions, lang);

  const getGenderText = (gender: string) => {
    if (gender === "Male") {
      return `${t("home:audio_tab.generate.male")}`;
    } else if (gender === "Female") {
      return t("home:audio_tab.generate.female");
    }
    return null;
  };

  const getProviderText = (provider: string) => {
    switch (provider) {
      case "azure":
        return `${t("home:audio_tab.generate.azure")}`;
      case "doubao":
        return `${t("home:audio_tab.generate.doubao")}`;
      case "fish":
        return `${t("home:audio_tab.generate.fish")}`;
      case "minimax":
        return `${t("home:audio_tab.generate.minimax")}`;
      case "openai":
        return `${t("home:audio_tab.generate.openai")}`;
    }
    return "";
  };

  const onChange =
    (newProvider?: string, newLang?: string, newSpeaker?: string) =>
    (nowOptions = options) => {
      const newValue: AudioSelectorValueType = {
        provider: newProvider || "",
        lang: newLang || "",
        speaker: newSpeaker || "",
      };
      if (!newProvider && !newLang && !newSpeaker) {
        // set default value
        newValue.provider = "doubao";
        newValue.speaker = "zh_female_cancan_mars_bigtts";
        newValue.lang = "default";
        onChangeParent(newValue);
        return;
      }
      // no provider
      if (!newProvider) {
        newValue.provider = nowOptions[0].value;
      }
      const langChildren = getSelectItemsLangChildren(
        nowOptions,
        newValue.provider
      );
      // no lang
      if (!newLang) {
        newValue.lang = langChildren[0].value;
      }
      // no speaker
      if (!newSpeaker) {
        newValue.speaker = getSelectItemsChildren(
          langChildren,
          newValue.lang
        )[0].name;
      }
      onChangeParent(newValue);
      return;
    };

  const init = async () => {
    if (!uiLang || !isAuthed || !_hasHydrated) {
      toast.error(t("auth:home.api-key-error"));
      return;
    }
    const result = await ajaxGetVoiceModel(uiLang);
    result.sort((a, b) => {
      if (a.value === "doubao") return -1;
      if (b.value === "doubao") return 1;
      return a.value.localeCompare(b.value);
    });
    setOptions(result);
    try {
      onChange(provider, lang, speaker)(result);
    } catch (error) {
      logger.error(error);
    }
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiLang, isAuthed, _hasHydrated]);

  return (
    <>
      <Select
        value={provider}
        onValueChange={(newValue) => onChange(newValue)()}
      >
        <SelectTrigger className="w-2/5 shrink-0">
          <SelectValue
            placeholder={t("home:audio_tab.generate.placeholder_platform")}
          />
        </SelectTrigger>
        <SelectContent>
          {options.map((providerItem) => (
            <SelectItem key={providerItem.value} value={providerItem.value}>
              {getProviderText(providerItem.value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {provider === "azure" && (
        <Select
          value={lang}
          onValueChange={(newValue) => onChange(provider, newValue)()}
        >
          <SelectTrigger className="w-2/5 shrink-0">
            <SelectValue
              placeholder={t("home:audio_tab.generate.placeholder_language")}
            />
          </SelectTrigger>
          <SelectContent>
            {langOptions.map((langItem) => (
              <SelectItem key={langItem.value} value={langItem.value}>
                {langItem.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select
        value={speaker}
        onValueChange={(newValue) => onChange(provider, lang, newValue)()}
      >
        <SelectTrigger className="flex-1 shrink-0">
          <SelectValue
            placeholder={t("home:audio_tab.generate.placeholder_speaker")}
          />
        </SelectTrigger>
        <SelectContent>
          {speakerOptions.map((speaker) => (
            <SelectItem key={speaker.name} value={speaker.name}>
              {speaker.displayName} {getGenderText(speaker.gender)}
            </SelectItem>
          ))}
          {speakerOptions.length === 0 && (
            <SelectItem disabled={true} value={"None"}>
              {t("home:audio_tab.generate.no_speaker_options")}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </>
  );
};
export type { AudioSelectorValueType };
export { AudioSelector };
