import { apiKy } from "@/api";
import { createScopedLogger, Logger } from "@/utils";
import { useState } from "react";
import ISO6391 from "iso-639-1";

export interface AudioVoiceSpeakerItem {
  name: string;
  displayName: string;
  gender: string;
  locale: string;
  langs: string[];
}
/**
 * Options Item
 */
export interface AudioVoiceLangOptionItem {
  label: string;
  value: string;
  children: AudioVoiceSpeakerItem[];
}
/**
 * Options Item
 */
export interface AudioVoiceOptionItem {
  label: string;
  value: string;
  children: AudioVoiceLangOptionItem[];
}

const getAzureLangOptions = (options: AudioVoiceSpeakerItem[]) => {
  const map = new Map<string, AudioVoiceSpeakerItem[]>();

  options.forEach((item) => {
    const { locale } = item;
    const lang = locale.split("-")[0];
    if (!ISO6391.validate(lang)) {
      return;
    }
    const subOptions = map.get(lang) || [];
    map.set(lang, [...subOptions, item]);
  });

  const result: AudioVoiceLangOptionItem[] = [];
  map.forEach((items, lang) => {
    const resultItem: AudioVoiceLangOptionItem = {
      label: ISO6391.getNativeName(lang),
      value: lang,
      children: items,
    };
    result.push(resultItem);
  });

  result.sort((a, b) => {
    if (a.value === "zh") return -1;
    if (b.value === "zh") return 1;
    return a.label.localeCompare(b.label);
  });
  return result;
};

const ajaxGet = async (_uiLang: string, logger: Logger) => {
  const url = "302/podcast/voices";
  const res = await apiKy
    .get(url)
    .json<Record<string, AudioVoiceSpeakerItem[]>>();
  const result: AudioVoiceOptionItem[] = [];
  try {
    const keys = Object.keys(res);
    keys.forEach((item) => {
      const optionSubItemRaw = res[item];

      const optionSubItems: AudioVoiceSpeakerItem[] = optionSubItemRaw.map(
        (subItem) => ({
          name: subItem.name,
          displayName: subItem.displayName,
          gender: subItem.gender,
          locale: subItem.locale,
          langs: subItem.langs,
        })
      );

      let langOptionItems: AudioVoiceLangOptionItem[] = [];
      if (item !== "azure") {
        const langOptionItem: AudioVoiceLangOptionItem = {
          label: "default",
          value: "default",
          children: optionSubItems,
        };
        langOptionItems.push(langOptionItem);
      } else {
        langOptionItems = getAzureLangOptions(optionSubItems);
      }

      const optionItem: AudioVoiceOptionItem = {
        label: item,
        value: item,
        children: langOptionItems,
      };

      result.push(optionItem);
    });
  } catch (error) {
    logger.error(error);
  }
  return result;
};

const useAudioVoiceOptions = () => {
  const [loading, setLoading] = useState(false);

  const logger = createScopedLogger("Home");

  const ajaxGetVoiceModel = async (uiLang: string) => {
    setLoading(true);
    const result = await ajaxGet(uiLang, logger);
    setLoading(false);
    return result;
  };

  return {
    loading,
    ajaxGetVoiceModel,
  };
};
export { useAudioVoiceOptions };
