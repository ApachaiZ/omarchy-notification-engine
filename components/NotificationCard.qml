// Notification card. Pure presentational — no service, Notification, or
// ListModel references. The popup container drives its lifetime and the
// center renders archived notifications separately.

import QtQuick
import QtQuick.Layouts
import Quickshell
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "../NotificationLogic.js" as NotificationLogic

BorderSurface {
  id: root

  property string app: ""
  property string appIcon: ""
  property string summary: ""
  property string body: ""
  property string image: ""
  // Nerd Font glyph rendered in the icon slot when no real icon is set.
  // Used by omarchy-notification-send so user-action toasts (`Silenced
  // notifications` etc.) show their bell/lock/etc. glyph without leaking
  // into the summary text.
  property string glyph: ""
  // NotificationUrgency: Low=0, Normal=1, Critical=2 (upstream).
  property int urgency: 1
  property int cornerRadius: 0

  // System monospace font injected by the container.
  property string fontFamily: ""

  readonly property bool hovered: hoverTracker.hovered

  signal closeRequested()
  signal cardClicked()

  // Notification images are local copies after the service persists them;
  // anything else is rejected before the renderer can issue a request.
  readonly property string mediaSource: NotificationLogic.safeImageSource(image)
  readonly property string iconSourceValue: iconSource(appIcon)
  readonly property bool hasMedia: mediaSource.length > 0
  readonly property bool hasGlyph: glyph.length > 0
  readonly property bool singleLineToast: sanitizedBody.length === 0 && !hasMedia
  readonly property bool compactGlyph: NotificationLogic.shouldRenderCompactGlyph(glyph, iconSourceValue, singleLineToast) && !hasMedia
  readonly property bool hasSmallIcon: iconSourceValue.length > 0 || hasGlyph
  readonly property bool summaryStartsWithGlyph: NotificationLogic.summaryStartsWithGlyph(summary)
  readonly property bool collapseRedundantIcon: singleLineToast && !hasGlyph && summaryStartsWithGlyph
  readonly property string sanitizedBody: sanitizeBody(body)
  readonly property string styledBody: NotificationLogic.styledSanitizedBody(sanitizedBody)
  readonly property string displayApp: app === "omarchy-action" ? "Omarchy" : app

  readonly property color dimColor: Qt.darker(Commons.Color.notifications.text, 1.45)
  readonly property color bodyColor: Qt.darker(Commons.Color.notifications.text, 1.12)
  readonly property color accentColor: urgency === 2
    ? Commons.Color.urgent
    : (urgency === 0 ? dimColor : Commons.Color.notifications.countdown)
  readonly property var cardBorderSpec: Border.surfaceSpec(
    "notifications", "border", Commons.Color.notifications.border, Math.max(1, Style.space(2)))

  function sanitizeBody(s) {
    return NotificationLogic.sanitizeBody(s, app, appIcon)
  }

  function iconSource(icon) {
    var value = String(icon || "")
    if (value.length === 0) return ""
    if (value.indexOf("file://") === 0 || value.indexOf("image://") === 0) return value
    if (value.charAt(0) === "/") return Util.fileUrl(value)
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return ""
    return Quickshell.iconPath(value, true)
  }

  implicitWidth: Style.space(380)
  implicitHeight: mainColumn.implicitHeight + borderTop + borderBottom
  radius: cornerRadius
  color: Commons.Color.notifications.background
  borderSpec: cardBorderSpec
  clip: true

  HoverHandler { id: hoverTracker }

  MouseArea {
    anchors.fill: parent
    cursorShape: Qt.PointingHandCursor
    acceptedButtons: Qt.LeftButton | Qt.RightButton
    onClicked: function(mouse) {
      if (mouse.button === Qt.RightButton) root.closeRequested()
      else root.cardClicked()
    }
  }

  // Urgency rail: critical toasts are recognizable even before the text is
  // read, while low-urgency toasts recede.
  Rectangle {
    visible: root.urgency !== 1
    anchors.left: parent.left
    anchors.leftMargin: root.borderLeft + Style.space(4)
    anchors.top: parent.top
    anchors.bottom: parent.bottom
    anchors.topMargin: Style.space(10)
    anchors.bottomMargin: Style.space(10)
    width: Math.max(2, Style.space(2))
    radius: width / 2
    color: root.accentColor
    opacity: 0.85
  }

  ColumnLayout {
    id: mainColumn
    anchors.top: parent.top
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.topMargin: root.borderTop
    anchors.leftMargin: root.borderLeft
    anchors.rightMargin: root.borderRight
    spacing: 0

    RowLayout {
      Layout.fillWidth: true
      Layout.leftMargin: Style.space(12)
      Layout.rightMargin: Style.space(30)
      Layout.topMargin: root.singleLineToast ? Style.space(7) : Style.space(10)
      Layout.bottomMargin: root.singleLineToast ? Style.space(7) : Style.space(10)
      spacing: root.collapseRedundantIcon ? 0 : (root.compactGlyph ? Style.space(8) : Style.space(10))

      Item {
        id: iconSlot
        readonly property real tileSize: Style.space(root.singleLineToast ? 32 : 40)
        Layout.preferredWidth: visible ? tileSize : 0
        Layout.preferredHeight: tileSize
        Layout.alignment: Qt.AlignVCenter
        visible: !root.collapseRedundantIcon && !root.compactGlyph && root.hasSmallIcon

        Rectangle {
          anchors.fill: parent
          radius: Math.min(Style.cornerRadius, Math.round(width * 0.28))
          color: Style.normalFillFor(Commons.Color.notifications.text, Commons.Color.accent)
          border.width: 1
          border.color: Qt.rgba(Commons.Color.notifications.text.r,
            Commons.Color.notifications.text.g,
            Commons.Color.notifications.text.b, 0.12)
        }

        Image {
          anchors.fill: parent
          anchors.margins: Math.round(iconSlot.tileSize * 0.2)
          source: root.iconSourceValue
          sourceSize.width: Math.max(1, Math.round(iconSlot.tileSize * 0.6 * Screen.devicePixelRatio))
          sourceSize.height: Math.max(1, Math.round(iconSlot.tileSize * 0.6 * Screen.devicePixelRatio))
          fillMode: Image.PreserveAspectFit
          asynchronous: true
          smooth: true
          visible: root.iconSourceValue !== ""
        }

        Text {
          anchors.centerIn: parent
          textFormat: Text.PlainText
          visible: root.hasGlyph && root.iconSourceValue === ""
          text: root.glyph
          color: Commons.Color.notifications.text
          font.family: root.fontFamily
          font.pixelSize: Style.font.icon
        }
      }

      Text {
        Layout.alignment: Qt.AlignVCenter
        textFormat: Text.PlainText
        visible: root.compactGlyph
        text: root.glyph
        color: Commons.Color.notifications.text
        font.family: root.fontFamily
        font.pixelSize: Style.font.icon
      }

      ColumnLayout {
        Layout.fillWidth: true
        Layout.alignment: Qt.AlignVCenter
        spacing: Style.space(2)

        RowLayout {
          Layout.fillWidth: true
          visible: !root.singleLineToast && (root.displayApp !== "" || root.urgency !== 1)
          spacing: Style.space(6)

          Text {
            Layout.fillWidth: true
            textFormat: Text.PlainText
            text: root.displayApp
            color: root.dimColor
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            elide: Text.ElideRight
          }

          Text {
            textFormat: Text.PlainText
            text: root.urgency === 2 ? "CRITICAL" : (root.urgency === 0 ? "LOW" : "")
            color: root.accentColor
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            font.letterSpacing: 0.8
            visible: text !== ""
          }
        }

        Text {
          // The spec defines the summary as a single line of plain text, so
          // AutoText could only ever promote a hostile string to rich text.
          // The body below is StyledText on purpose — see NotificationLogic's
          // sanitizer — and is stripped before it reaches this component.
          textFormat: Text.PlainText
          Layout.fillWidth: true
          visible: root.summary.length > 0
          text: root.summary
          color: Commons.Color.notifications.text
          font.family: root.fontFamily
          font.pixelSize: Style.font.title
          font.bold: true
          wrapMode: Text.WordWrap
          elide: Text.ElideRight
          maximumLineCount: 2
        }

        Text {
          Layout.fillWidth: true
          Layout.topMargin: Style.space(1)
          visible: root.sanitizedBody.length > 0
          text: root.styledBody
          textFormat: Text.StyledText
          color: root.bodyColor
          font.family: root.fontFamily
          font.pixelSize: Style.font.body
          wrapMode: Text.WordWrap
          elide: Text.ElideRight
          maximumLineCount: 3
        }
      }
    }

    Rectangle {
      Layout.fillWidth: true
      Layout.preferredHeight: Style.space(120)
      Layout.leftMargin: Style.space(12)
      Layout.rightMargin: Style.space(12)
      Layout.bottomMargin: Style.space(10)
      visible: root.hasMedia && mediaImage.status !== Image.Error
      radius: Math.max(Style.space(4), Math.round(Style.cornerRadius * 0.7))
      color: Style.normalFillFor(Commons.Color.notifications.text, Commons.Color.accent)
      clip: true

      Image {
        id: mediaImage
        anchors.fill: parent
        source: root.mediaSource
        sourceSize.width: Math.round(root.width * Screen.devicePixelRatio)
        sourceSize.height: Math.round(Style.space(120) * Screen.devicePixelRatio)
        fillMode: Image.PreserveAspectCrop
        asynchronous: true
        smooth: true
      }
    }
  }

  // Hover-only close affordance. Right-click still closes immediately.
  PanelActionButton {
    anchors.top: parent.top
    anchors.right: parent.right
    anchors.topMargin: root.borderTop + Style.space(5)
    anchors.rightMargin: root.borderRight + Style.space(4)
    visible: root.hovered
    size: Style.space(22)
    iconText: "󰅖"
    tooltipText: "Dismiss"
    foreground: root.dimColor
    hoverColor: Commons.Color.urgent
    fontFamily: root.fontFamily
    onClicked: root.closeRequested()
  }
}
