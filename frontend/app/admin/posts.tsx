import React, { useCallback, useState } from "react";
import { View, FlatList, Pressable, StyleSheet, Modal, ScrollView, Platform, Linking } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import Button from "@/src/components/Button";
import FormField from "@/src/components/FormField";
import { useToast } from "@/src/components/Toast";
import { api, API, resolveImageUri } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme/theme";

export default function ManagePosts() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [posts, setPosts] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [type, setType] = useState<"blog" | "vlog">("blog");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  const load = useCallback(() => {
    api.listPosts().then(setPosts).catch(() => {});
  }, []);

  useFocusEffect(load);

  const openForm = (p?: any) => {
    setEditing(p || null);
    setType(p?.type || "blog");
    setTitle(p?.title || "");
    setContent(p?.content || "");
    setCoverImage(p?.cover_image || "");
    setVideoUrl(p?.video_url || "");
    setYoutubeUrl(p?.youtube_url || "");
    setModal(true);
  };

  const ensureGallery = async (): Promise<boolean> => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (perm.granted) return true;
    if (perm.canAskAgain || perm.status === "undetermined") {
      const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (req.granted) return true;
      toast.show("Gallery access is needed to pick media");
      return false;
    }
    toast.show("Gallery access denied — enable it in Settings");
    Linking.openSettings().catch(() => {});
    return false;
  };

  const uploadAsset = async (asset: ImagePicker.ImagePickerAsset, endpoint: string, field: string) => {
    const name = asset.fileName || `media_${Date.now()}`;
    const mime = asset.mimeType || (endpoint.includes("video") ? "video/mp4" : "image/jpeg");
    const form = new FormData();
    if (Platform.OS === "web") {
      const blob = await (await fetch(asset.uri)).blob();
      form.append("file", blob, name);
    } else {
      form.append("file", { uri: asset.uri, name, type: mime } as any);
    }
    const res = await fetch(`${API}${endpoint}`, { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.detail || "Upload failed");
    }
    const data = await res.json();
    return data[field];
  };

  const pickCover = async () => {
    if (!(await ensureGallery())) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (result.canceled || !result.assets?.length) return;
    setUploading(true);
    try {
      const url = await uploadAsset(result.assets[0], "/upload", "image_url");
      setCoverImage(url);
      toast.show("Cover image uploaded");
    } catch (e: any) {
      toast.show(e?.message || "Could not upload image");
    } finally {
      setUploading(false);
    }
  };

  const pickVideo = async () => {
    if (!(await ensureGallery())) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"] });
    if (result.canceled || !result.assets?.length) return;
    setUploading(true);
    try {
      const url = await uploadAsset(result.assets[0], "/upload/video", "video_url");
      setVideoUrl(url);
      toast.show("Video uploaded");
    } catch (e: any) {
      toast.show(e?.message || "Could not upload video (max 50 MB)");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!title.trim()) return toast.show("Enter a title");
    if (type === "blog" && !content.trim()) return toast.show("Enter the blog content");
    if (type === "vlog" && !videoUrl && !youtubeUrl.trim())
      return toast.show("Upload a video or paste a YouTube link");
    setSaving(true);
    try {
      const payload = {
        type,
        title: title.trim(),
        content: content.trim(),
        cover_image: coverImage,
        video_url: videoUrl,
        youtube_url: youtubeUrl.trim(),
      };
      if (editing) await api.updatePost(editing.id, payload);
      else await api.createPost(payload);
      toast.show(editing ? "Post updated" : "Post published");
      setModal(false);
      load();
    } catch (e: any) {
      toast.show(e?.message || "Could not save post");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: any) => {
    try {
      await api.deletePost(p.id);
      setPosts((prev) => prev.filter((x) => x.id !== p.id));
      toast.show("Deleted");
    } catch {
      toast.show("Could not delete");
    }
  };

  const chip = (label: string, on: boolean, onPress: () => void, testID: string) => (
    <Pressable testID={testID} onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <AppText variant={on ? "semibold" : "body"} color={on ? "#fff" : colors.onSurface} style={styles.chipText}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="posts-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" style={styles.title}>
          Blogs & Vlogs
        </AppText>
        <Pressable testID="add-post" onPress={() => openForm()} hitSlop={12} style={styles.backBtn}>
          <Feather name="plus" size={22} color={colors.brand} />
        </Pressable>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
        ListEmptyComponent={
          <AppText variant="body" color={colors.muted} style={styles.empty}>
            No posts yet. Tap + to publish your first blog or vlog.
          </AppText>
        }
        renderItem={({ item }) => (
          <View style={styles.card} testID={`admin-post-${item.id}`}>
            <View style={{ flex: 1 }}>
              <AppText variant="semibold" style={styles.postTitle}>
                {item.title}
              </AppText>
              <AppText variant="body" color={colors.muted} style={styles.meta}>
                {item.type === "vlog" ? "Vlog" : "Blog"} · {(item.created_at || "").slice(0, 10)}
              </AppText>
            </View>
            <Pressable testID={`edit-post-${item.id}`} onPress={() => openForm(item)} hitSlop={8} style={styles.iconBtn}>
              <Feather name="edit-2" size={17} color={colors.onSurface} />
            </Pressable>
            <Pressable testID={`delete-post-${item.id}`} onPress={() => remove(item)} hitSlop={8} style={styles.iconBtn}>
              <Feather name="trash-2" size={17} color={colors.error} />
            </Pressable>
          </View>
        )}
      />

      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <AppText variant="displaySemiBold" style={styles.modalTitle}>
                {editing ? "Edit" : "New"} Post
              </AppText>
              <View style={styles.chipRow}>
                {chip("Text Blog", type === "blog", () => setType("blog"), "post-type-blog")}
                {chip("Video Vlog", type === "vlog", () => setType("vlog"), "post-type-vlog")}
              </View>
              <FormField testID="post-title" label="Title" value={title} onChangeText={setTitle} placeholder="Post title" />
              {type === "blog" ? (
                <>
                  <FormField
                    testID="post-content"
                    label="Blog content"
                    value={content}
                    onChangeText={setContent}
                    placeholder="Write your blog here…"
                    multiline
                    numberOfLines={8}
                    style={styles.contentInput}
                  />
                  <Button
                    testID="pick-cover"
                    label={coverImage ? "Change cover image" : "Add cover image (optional)"}
                    variant="secondary"
                    onPress={pickCover}
                    loading={uploading}
                    style={styles.mediaBtn}
                  />
                  {!!coverImage && (
                    <Image source={{ uri: resolveImageUri(coverImage) }} style={styles.coverPreview} contentFit="cover" />
                  )}
                </>
              ) : (
                <>
                  <Button
                    testID="pick-video"
                    label={videoUrl ? "Change uploaded video" : "Upload video (max 50 MB)"}
                    variant="secondary"
                    onPress={pickVideo}
                    loading={uploading}
                    style={styles.mediaBtn}
                  />
                  {!!videoUrl && (
                    <AppText variant="body" color={colors.success} style={styles.videoOk}>
                      ✓ Video uploaded
                    </AppText>
                  )}
                  <AppText variant="body" color={colors.muted} style={styles.orText}>
                    — or —
                  </AppText>
                  <FormField
                    testID="post-youtube"
                    label="YouTube link"
                    value={youtubeUrl}
                    onChangeText={setYoutubeUrl}
                    autoCapitalize="none"
                    placeholder="https://youtube.com/watch?v=…"
                  />
                </>
              )}
              <View style={styles.modalActions}>
                <Button label="Cancel" variant="secondary" onPress={() => setModal(false)} style={{ flex: 1 }} />
                <Button testID="save-post" label="Publish" onPress={save} loading={saving} style={{ flex: 1 }} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  empty: { fontSize: 13, textAlign: "center", marginTop: spacing.xl },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    marginBottom: spacing.md,
  },
  postTitle: { fontSize: 15 },
  meta: { fontSize: 12, marginTop: 2 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(20,24,20,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "88%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  modalTitle: { fontSize: 20, marginBottom: spacing.lg },
  chipRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 13 },
  contentInput: { minHeight: 140, textAlignVertical: "top" },
  mediaBtn: { marginBottom: spacing.md },
  coverPreview: { width: "100%", height: 140, borderRadius: radius.md, marginBottom: spacing.md },
  videoOk: { fontSize: 13, marginBottom: spacing.sm },
  orText: { fontSize: 12, textAlign: "center", marginBottom: spacing.sm },
  modalActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
});
