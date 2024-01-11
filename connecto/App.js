import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, SafeAreaView } from "react-native";
import { WebView } from "react-native-webview";

export default function App() {
  return (
    <View style={{ marginTop: 60, flex: 1 }}>
      <WebView
        style={styles.container}
        source={{
          uri: "https://03d5-2405-201-4018-9231-e1fc-e077-b362-9a1f.ngrok-free.app", //3001 port
        }}
        originWhitelist={["*"]}
        mediaPlaybackRequiresUserAction={false}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        allowUniversalAccessFromFileURLs={true}
        javaScriptEnabled={true}
        allowsInlineMediaPlayback={true}
      ></WebView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
