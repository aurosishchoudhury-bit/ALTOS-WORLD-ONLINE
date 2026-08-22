import React, { useEffect, useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, useWindowDimensions, Platform } from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { WebView } from "react-native-webview";

import AppText from "@/src/components/AppText";
import { api, resolveImageUri } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme/theme";

function youtubeEmbedUrl(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

function UploadedVideo({ uri, width }: { uri: string; width: number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={{ width, height: Math.round((width * 9) / 16), borderRadius: radius.lg, backgroundColor: "#000" }}
      allowsFullscreen
      nativeControls
    />
  );
}

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 560) - spacing.lg * 2;
  const [post, setPost] = useState<any>(null);

  useEffect(() => {
    if (id) api.getPost(id).then(setPost).catch(() => {});
  }, [id]);

  const embed = post?.youtube_url ? youtubeEmbedUrl(post.youtube_url) : null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="post-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" style={styles.title}>
          {post?.type === "vlog" ? "Vlog" : "Blog"}
        </AppText>
        <View style={styles.backBtn} />
      </View>

      {post && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <AppText variant="displaySemiBold" style={styles.postTitle}>
            {post.title}
          </AppText>
          <AppText variant="body" color={colors.muted} style={styles.date}>
            {(post.created_at || "").slice(0, 10)}
          </AppText>

          {post.type === "vlog" && !!post.video_url && (
            <View style={styles.mediaWrap}>
              <UploadedVideo uri={resolveImageUri(post.video_url)} width={contentWidth} />
            </View>
          )}

          {post.type === "vlog" && !post.video_url && !!embed && (
            <View style={[styles.mediaWrap, { height: Math.round((contentWidth * 9) / 16) }]}>
              {Platform.OS === "web" ? (
                // @ts-ignore — iframe works on web
                <iframe
                  src={embed}
                  style={{ width: contentWidth, height: Math.round((contentWidth * 9) / 16), border: 0, borderRadius: 12 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <WebView
                  source={{ uri: embed }}
                  style={{ width: contentWidth, height: Math.round((contentWidth * 9) / 16), borderRadius: radius.lg }}
                  allowsFullscreenVideo
                />
              )}
            </View>
          )}

          {!!post.cover_image && post.type === "blog" && (
            <Image
              source={{ uri: resolveImageUri(post.cover_image) }}
              style={[styles.cover, { width: contentWidth }]}
              contentFit="cover"
            />
          )}

          {!!post.content && (
            <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.content}>
              {post.content}
            </AppText>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16 },
  scroll: { padding: spacing.lg, paddingBottom: 80, maxWidth: 560, alignSelf: "center", width: "100%" },
  postTitle: { fontSize: 24, lineHeight: 32 },
  date: { fontSize: 12, marginTop: spacing.xs, marginBottom: spacing.lg },
  mediaWrap: { marginBottom: spacing.lg, borderRadius: radius.lg, overflow: "hidden" },
  cover: { height: 200, borderRadius: radius.lg, marginBottom: spacing.lg, backgroundColor: colors.surfaceTertiary },
  content: { fontSize: 15, lineHeight: 24 },
});
