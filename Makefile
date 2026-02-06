APP_NAME = kill-port
DMG_NAME = Kill Port
BUILD_DIR = build/bin

.PHONY: dev build dmg clean

# 开发模式（热更新）
dev:
	wails dev

# 构建 macOS .app
build:
	wails build
	@echo "\n✅ 构建完成: $(BUILD_DIR)/$(APP_NAME).app"

# 打包 DMG 安装包
dmg: build
	@rm -f "$(BUILD_DIR)/$(DMG_NAME).dmg"
	create-dmg \
		--volname "$(DMG_NAME)" \
		--window-pos 200 120 \
		--window-size 600 400 \
		--icon-size 80 \
		--icon "$(APP_NAME).app" 175 190 \
		--app-drop-link 425 190 \
		--hide-extension "$(APP_NAME).app" \
		"$(BUILD_DIR)/$(DMG_NAME).dmg" \
		"$(BUILD_DIR)/$(APP_NAME).app"
	@echo "\n✅ DMG 打包完成: $(BUILD_DIR)/$(DMG_NAME).dmg"

# 清理构建产物
clean:
	rm -rf $(BUILD_DIR)
	@echo "✅ 已清理"
