import React, { useEffect, useRef, useState } from "react";
import { View, FlatList, StyleSheet, useWindowDimensions } from "react-native";
import { Image } from "expo-image";

import { resolveImageUri } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme/theme";

type Banner = { id: string; image: string };

export default function BannerCarousel({ banners }: { banners: Banner[] }) {
  const { width } = useWindowDimensions();
  // Full-width on phones; capped on wide screens (web preview/tablets) so it doesn't blow up.
  const bannerWidth = Math.min(width - spacing.lg * 2, 420);
  const bannerHeight = Math.round((bannerWidth * 16) / 9); // 9:16 portrait ratio
  const listRef = useRef<FlatList>(null);
  const indexRef = useRef(0);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = setInterval(() => {
      const next = (indexRef.current + 1) % banners.length;
      indexRef.current = next;
      setActive(next);
      listRef.current?.scrollToOffset({ offset: next * bannerWidth, animated: true });
    }, 3500);
    return () => clearInterval(timer);
  }, [banners.length, bannerWidth]);

  if (banners.length === 0) return null;

  return (
    <View style={[styles.wrap, { width: bannerWidth }]} testID="banner-carousel">
      <FlatList
        ref={listRef}
        data={banners}
        keyExtractor={(b) => b.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={bannerWidth}
        decelerationRate="fast"
        getItemLayout={(_, i) => ({ length: bannerWidth, offset: bannerWidth * i, index: i })}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / bannerWidth);
          indexRef.current = i;
          setActive(i);
        }}
        renderItem={({ item }) => (
          <Image
            source={{ uri: resolveImageUri(item.image) }}
            style={[styles.banner, { width: bannerWidth, height: bannerHeight }]}
            contentFit="cover"
            transition={200}
          />
        )}
      />
      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
    alignSelf: "center",
  },
  banner: {
    backgroundColor: colors.surfaceSecondary,
  },
  dots: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    flexDirection: "row",
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
    width: 14,
  },
});
