import { Theme, useTheme } from "@react-navigation/native";
import Color from "color";
import { useMemo } from "react";

type IColors = Theme["colors"];

export interface CustomizedColors extends IColors {
    /** 普通文字 */
    text: string;
    /** 副标题文字颜色 */
    textSecondary?: string;
    /** 高亮文本颜色，也就是主色调 */
    textHighlight?: string;
    /** 页面背景 */
    pageBackground?: string;
    /** 阴影 */
    shadow?: string;
    /** 标题栏颜色 */
    appBar?: string;
    /** 标题栏字体颜色 */
    appBarText?: string;
    /** 音乐栏颜色 */
    musicBar?: string;
    /** 音乐栏字体颜色 */
    musicBarText?: string;
    /** 分割线 */
    divider?: string;
    /** 高亮颜色 */
    listActive?: string;
    /** 输入框背景色 */
    placeholder?: string;
    /** 弹窗、浮层、菜单背景色 */
    backdrop?: string;
    /** 卡片背景色 */
    card: string;
    /** paneltabbar 背景色 */
    tabBar?: string;
    /** 成功状态颜色 */
    success?: string;
    /** 危险状态颜色 */
    danger?: string;
    /** 信息颜色 */
    info?: string;
}

export default function useColors() {
    const { colors } = useTheme();

    const cColors: CustomizedColors = useMemo(() => {
        return {
            ...colors,
            // 仅在未显式配置 textSecondary 时派生，避免覆盖显式配置
            textSecondary:
                (colors as CustomizedColors).textSecondary ??
                Color(colors.text).alpha(0.7).toString(),
            // @ts-ignore
            background: colors.pageBackground ?? colors.background,
        };
    }, [colors]);

    return cColors;
}
