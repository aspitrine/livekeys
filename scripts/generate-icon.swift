// Usage: swift scripts/generate-icon.swift assets/icon.png
import AppKit
import CoreGraphics

// LiveKeys app icon: three stacked keyboard "layers" on a dark background.
let size: CGFloat = 1024
let space = CGColorSpaceCreateDeviceRGB()
let ctx = CGContext(data: nil, width: Int(size), height: Int(size), bitsPerComponent: 8, bytesPerRow: 0,
                    space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
// Top-left origin, like a design tool.
ctx.translateBy(x: 0, y: size)
ctx.scaleBy(x: 1, y: -1)

func rgb(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
  CGColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
          blue: CGFloat(hex & 0xFF) / 255, alpha: a)
}
func gradient(_ colors: [CGColor]) -> CGGradient {
  CGGradient(colorsSpace: space, colors: colors as CFArray, locations: nil)!
}
func rounded(_ r: CGRect, _ radius: CGFloat) -> CGPath {
  CGPath(roundedRect: r, cornerWidth: radius, cornerHeight: radius, transform: nil)
}

// Background: deep blue-grey vertical gradient + soft glow behind the keys.
ctx.drawLinearGradient(gradient([rgb(0x262A40), rgb(0x0C0D14)]),
                       start: CGPoint(x: 0, y: 0), end: CGPoint(x: 0, y: size), options: [])
ctx.drawRadialGradient(gradient([rgb(0x4F8CFF, 0.38), rgb(0x4F8CFF, 0)]),
                       startCenter: CGPoint(x: 512, y: 560), startRadius: 0,
                       endCenter: CGPoint(x: 512, y: 560), endRadius: 520, options: [])

/// A layer card with a soft drop shadow, filled with a diagonal gradient.
func card(_ rect: CGRect, _ top: UInt32, _ bottom: UInt32, radius: CGFloat = 58) {
  let path = rounded(rect, radius)
  ctx.saveGState()
  ctx.setShadow(offset: CGSize(width: 0, height: 18), blur: 40, color: rgb(0x000000, 0.55))
  ctx.addPath(path)
  ctx.setFillColor(rgb(bottom))
  ctx.fillPath()
  ctx.restoreGState()

  ctx.saveGState()
  ctx.addPath(path)
  ctx.clip()
  ctx.drawLinearGradient(gradient([rgb(top), rgb(bottom)]),
                         start: CGPoint(x: rect.minX, y: rect.minY), end: CGPoint(x: rect.maxX, y: rect.maxY), options: [])
  ctx.restoreGState()
}

// Back layers peeking above the front keyboard.
card(CGRect(x: 262, y: 236, width: 500, height: 340), 0xF06AB8, 0xB0277E)
card(CGRect(x: 222, y: 336, width: 580, height: 340), 0xFFC15A, 0xE58A12)

// Front layer: blue top strip (like the layer color bars in the app) + piano keys.
let front = CGRect(x: 172, y: 446, width: 680, height: 352)
card(front, 0x6FA2FF, 0x2F66E0, radius: 62)

let strip: CGFloat = 70
let keys = CGRect(x: front.minX + 22, y: front.minY + strip, width: front.width - 44, height: front.height - strip - 22)
ctx.saveGState()
ctx.addPath(rounded(keys, 30))
ctx.clip()
ctx.drawLinearGradient(gradient([rgb(0xFFFFFF), rgb(0xE4E7EF)]),
                       start: CGPoint(x: 0, y: keys.minY), end: CGPoint(x: 0, y: keys.maxY), options: [])

// White key separators.
let whiteCount = 7
let w = keys.width / CGFloat(whiteCount)
ctx.setFillColor(rgb(0xB9BECB))
for i in 1..<whiteCount {
  ctx.fill(CGRect(x: keys.minX + CGFloat(i) * w - 2.5, y: keys.minY, width: 5, height: keys.height))
}

// Black keys after C, D, F, G, A.
let blackW = w * 0.58
let blackH = keys.height * 0.6
for i in [0, 1, 3, 4, 5] {
  let r = CGRect(x: keys.minX + CGFloat(i + 1) * w - blackW / 2, y: keys.minY - 12, width: blackW, height: blackH + 12)
  ctx.saveGState()
  ctx.addPath(rounded(r, 12))
  ctx.clip()
  ctx.drawLinearGradient(gradient([rgb(0x2A2D3A), rgb(0x0E0F15)]),
                         start: CGPoint(x: 0, y: r.minY), end: CGPoint(x: 0, y: r.maxY), options: [])
  ctx.restoreGState()
}
ctx.restoreGState()

let image = ctx.makeImage()!
let out = URL(fileURLWithPath: CommandLine.arguments[1])
let rep = NSBitmapImageRep(cgImage: image)
try rep.representation(using: .png, properties: [:])!.write(to: out)
print("wrote", out.path)
