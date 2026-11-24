import { Dimensions } from "react-native";

function getMinWindowEdge() {
    const { height, width } = Dimensions.get("window");
    return Math.min(height, width);
}

function getMaxWindowEdge() {
    const { height, width } = Dimensions.get("window");
    return Math.max(height, width);
}

export default function (rpx: number) {
    return (rpx / 750) * getMinWindowEdge();
}

export function vh(pct: number) {
    return (pct / 100) * Dimensions.get("window").height;
}

export function vw(pct: number) {
    return (pct / 100) * Dimensions.get("window").width;
}

export function vmin(pct: number) {
    return (pct / 100) * getMinWindowEdge();
}

export function vmax(pct: number) {
    return (pct / 100) * getMaxWindowEdge();
}

export function sh(pct: number) {
    return (pct / 100) * Dimensions.get("screen").height;
}

export function sw(pct: number) {
    return (pct / 100) * Dimensions.get("screen").width;
}
