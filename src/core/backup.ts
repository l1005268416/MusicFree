/** 备份与恢复 */
/** 歌单、插件 */
import { compare } from "compare-versions";
import PluginManager from "./pluginManager";
import MusicSheet from "@/core/musicSheet";
import { ResumeMode } from "@/constants/commonConst.ts";
import type { IInstallPluginResult } from "@/types/core/pluginManager";

/**
 * 结果：一份大的json文件
 * {
 *     musicSheets: [],
 *     plugins: [],
 * }
 */

interface IBackJson {
    musicSheets: IMusic.IMusicSheetItem[];
    plugins: Array<{ srcUrl: string; version: string }>;
}

function backup() {
    const musicSheets = MusicSheet.backupSheets();
    const plugins = PluginManager.getEnabledPlugins();
    const normalizedPlugins = plugins.map(_ => ({
        srcUrl: _.instance.srcUrl,
        version: _.instance.version,
    }));

    return JSON.stringify({
        musicSheets: musicSheets,
        plugins: normalizedPlugins,
    });
}

async function resume(
    raw: string | Object,
    resumeMode: ResumeMode = ResumeMode.Append,
) {
    let obj: IBackJson;
    if (typeof raw === "string") {
        try {
            obj = JSON.parse(raw);
        } catch {
            throw new Error("备份文件格式无效");
        }
    } else {
        obj = raw as IBackJson;
    }

    const { plugins, musicSheets } = obj ?? {};
    /** 恢复插件 */
    const validPlugins = PluginManager.getEnabledPlugins();
    const resumePlugins = plugins?.map(_ => {
        // 校验是否安装过: 同源且本地版本更高就忽略掉
        if (
            validPlugins.find(
                plugin =>
                    plugin.instance.srcUrl === _.srcUrl &&
                    compare(
                        plugin.instance.version ?? "0.0.0",
                        _.version ?? "0.0.1",
                        ">=",
                    ),
            )
        ) {
            return undefined;
        }
        return PluginManager.installPluginFromUrl(_.srcUrl);
    });

    /** 恢复歌单 */
    const resumeMusicSheets = MusicSheet.resumeSheets(musicSheets, resumeMode);

    // 等待所有插件安装结果，个别失败不阻塞歌单恢复
    const pluginResults = await Promise.all(
        (resumePlugins ?? []).map(async r => {
            if (!r) return null;
            try {
                return await r;
            } catch (e: any) {
                return {
                    success: false,
                    message: e?.message ?? String(e),
                } as IInstallPluginResult;
            }
        }),
    );
    await resumeMusicSheets;

    const failed = pluginResults.filter(
        (r): r is IInstallPluginResult => !!r && !r.success,
    );
    if (failed.length) {
        throw new Error(
            `${failed.length} 个插件恢复失败（${failed
                .slice(0, 2)
                .map(f => f.message ?? "未知原因")
                .join("；")}${failed.length > 2 ? "..." : ""}）`,
        );
    }
}

const Backup = {
    backup,
    resume,
};
export default Backup;
