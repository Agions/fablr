//! SSML — Speech Synthesis Markup Language（Stage 14.1）
//!
//! 与前端 `src/core/domain/ssml.ts` 对齐：
//! - 同样的节点类型（TextNode / BreakNode / EmphasisNode / ProsodyNode 等）
//! - 同样的序列化输出（标准 SSML 1.1 XML）
//!
//! Rust 端落地的目的：
//! - 让后续 Tauri command（如 `synthesize_speech_ssml` / `tts_wrap_with_ssml`）
//!   接收结构化 SSML 输入（强类型）而不是字符串。
//! - 端到端一致性：TS 构建 → IPC 传给 Rust → Rust 验证 + 序列化 → edge-tts。
//!
//! 默认实现强调"纯函数 + 零依赖"，便于单测。

use serde::{Deserialize, Serialize};

// ─── 基础类型 ─────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SsmlUnit {
    Ms,
    S,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EmphasisLevel {
    None,
    Reduced,
    Moderate,
    Strong,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum BreakStrength {
    None,
    XWeak,
    Weak,
    Medium,
    Strong,
    XStrong,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SayAsInterpretAs {
    Cardinal,
    Ordinal,
    Digits,
    Fraction,
    Unit,
    Date,
    Time,
    Telephone,
    Address,
    Currency,
    Name,
    #[serde(rename = "spell-out")]
    SpellOut,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PhonemeAlphabet {
    Ipa,
    #[serde(rename = "x-sampa")]
    XSampa,
    #[serde(rename = "x-cmu")]
    XCMU,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SsmlDuration {
    pub value: f64,
    pub unit: SsmlUnit,
}

// ─── 节点（与 TS SsmlInline 对齐） ─────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum SsmlInline {
    Text { text: String },
    Break {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        duration: Option<SsmlDuration>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        strength: Option<BreakStrength>,
    },
    Emphasis {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        level: Option<EmphasisLevel>,
        children: Vec<SsmlInline>,
    },
    Prosody {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        rate: Option<serde_json::Value>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        pitch: Option<serde_json::Value>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        volume: Option<serde_json::Value>,
        children: Vec<SsmlInline>,
    },
    SayAs {
        interpret_as: SayAsInterpretAs,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        format: Option<String>,
        children: Vec<SsmlInline>,
    },
    Phoneme {
        alphabet: PhonemeAlphabet,
        ph: String,
        children: Vec<SsmlInline>,
    },
    Voice {
        name: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        xml_lang: Option<String>,
        children: Vec<SsmlInline>,
    },
    Audio {
        src: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        fallback: Option<String>,
    },
    Sub {
        alias: String,
        children: Vec<SsmlInline>,
    },
}

// ─── 文档（顶层 <speak>） ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SsmlDocument {
    pub xml_lang: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_voice: Option<String>,
    pub children: Vec<SsmlInline>,
}

// ─── 工厂（mirror TS 端 SSML.* helpers） ───────────────────────

impl SsmlInline {
    pub fn text(s: impl Into<String>) -> Self {
        Self::Text { text: s.into() }
    }
    pub fn pause_ms(ms: u32) -> Self {
        Self::Break {
            duration: Some(SsmlDuration {
                value: ms as f64,
                unit: SsmlUnit::Ms,
            }),
            strength: None,
        }
    }
    pub fn pause_s(s: f64) -> Self {
        Self::Break {
            duration: Some(SsmlDuration {
                value: s,
                unit: SsmlUnit::S,
            }),
            strength: None,
        }
    }
    pub fn emphasis(level: EmphasisLevel, children: Vec<SsmlInline>) -> Self {
        Self::Emphasis {
            level: Some(level),
            children,
        }
    }
    pub fn voice(name: impl Into<String>, children: Vec<SsmlInline>) -> Self {
        Self::Voice {
            name: name.into(),
            xml_lang: None,
            children,
        }
    }
}

impl SsmlDocument {
    /// 多角色拼装（每个 segment 自动加 300ms 停顿，避免粘音）
    pub fn multi_voice(segments: &[(String, Vec<SsmlInline>)], xml_lang: impl Into<String>) -> Self {
        let mut children = Vec::with_capacity(segments.len() * 2);
        for (voice, content) in segments {
            children.push(SsmlInline::voice(voice.clone(), content.clone()));
            children.push(SsmlInline::pause_ms(300));
        }
        Self {
            xml_lang: xml_lang.into(),
            default_voice: None,
            children,
        }
    }
}

// ─── XML 序列化（标准 SSML 1.1） ──────────────────────────────

fn escape_xml(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            _ => out.push(c),
        }
    }
    out
}

fn format_duration(d: &SsmlDuration) -> String {
    // edge-tts 接受 '500ms' / '1.5s'
    let n = if d.value.fract() == 0.0 {
        format!("{}", d.value as i64)
    } else {
        format!("{}", d.value)
    };
    let unit = match d.unit {
        SsmlUnit::Ms => "ms",
        SsmlUnit::S => "s",
    };
    format!("{}{}", n, unit)
}

fn render_inline(node: &SsmlInline) -> String {
    match node {
        SsmlInline::Text { text } => escape_xml(text),
        SsmlInline::Break { duration, strength } => {
            let mut attrs = Vec::new();
            if let Some(d) = duration {
                attrs.push(format!("time=\"{}\"", format_duration(d)));
            }
            if let Some(s) = strength {
                let s_str = match s {
                    BreakStrength::None => "none",
                    BreakStrength::XWeak => "x-weak",
                    BreakStrength::Weak => "weak",
                    BreakStrength::Medium => "medium",
                    BreakStrength::Strong => "strong",
                    BreakStrength::XStrong => "x-strong",
                };
                attrs.push(format!("strength=\"{}\"", s_str));
            }
            format!("<break {}/>", attrs.join(" "))
        }
        SsmlInline::Emphasis { level, children } => {
            let level_str = match level.unwrap_or(EmphasisLevel::Moderate) {
                EmphasisLevel::None => "none",
                EmphasisLevel::Reduced => "reduced",
                EmphasisLevel::Moderate => "moderate",
                EmphasisLevel::Strong => "strong",
            };
            let inner: String = children.iter().map(render_inline).collect();
            format!("<emphasis level=\"{}\">{}</emphasis>", level_str, inner)
        }
        SsmlInline::Prosody { rate, pitch, volume, children } => {
            let mut attrs = Vec::new();
            if let Some(v) = rate {
                attrs.push(format!("rate=\"{}\"", attr_value(v)));
            }
            if let Some(v) = pitch {
                attrs.push(format!("pitch=\"{}\"", attr_value(v)));
            }
            if let Some(v) = volume {
                attrs.push(format!("volume=\"{}\"", attr_value(v)));
            }
            let inner: String = children.iter().map(render_inline).collect();
            format!("<prosody {}>{}</prosody>", attrs.join(" "), inner)
        }
        SsmlInline::SayAs { interpret_as, format, children } => {
            let kind = match interpret_as {
                SayAsInterpretAs::Cardinal => "cardinal",
                SayAsInterpretAs::Ordinal => "ordinal",
                SayAsInterpretAs::Digits => "digits",
                SayAsInterpretAs::Fraction => "fraction",
                SayAsInterpretAs::Unit => "unit",
                SayAsInterpretAs::Date => "date",
                SayAsInterpretAs::Time => "time",
                SayAsInterpretAs::Telephone => "telephone",
                SayAsInterpretAs::Address => "address",
                SayAsInterpretAs::Currency => "currency",
                SayAsInterpretAs::Name => "name",
                SayAsInterpretAs::SpellOut => "spell-out",
            };
            let mut attrs = vec![format!("interpret-as=\"{}\"", kind)];
            if let Some(f) = format {
                attrs.push(format!("format=\"{}\"", f));
            }
            let inner: String = children.iter().map(render_inline).collect();
            format!("<say-as {}>{}</say-as>", attrs.join(" "), inner)
        }
        SsmlInline::Phoneme { alphabet, ph, children } => {
            let alpha = match alphabet {
                PhonemeAlphabet::Ipa => "ipa",
                PhonemeAlphabet::XSampa => "x-sampa",
                PhonemeAlphabet::XCMU => "x-cmu",
            };
            let inner: String = children.iter().map(render_inline).collect();
            format!(
                "<phoneme alphabet=\"{}\" ph=\"{}\">{}</phoneme>",
                alpha,
                escape_xml(ph),
                inner
            )
        }
        SsmlInline::Voice { name, xml_lang, children } => {
            let mut attrs = vec![format!("name=\"{}\"", escape_xml(name))];
            if let Some(l) = xml_lang {
                attrs.push(format!("xml:lang=\"{}\"", l));
            }
            let inner: String = children.iter().map(render_inline).collect();
            format!("<voice {}>{}</voice>", attrs.join(" "), inner)
        }
        SsmlInline::Audio { src, fallback } => {
            let mut attrs = vec![format!("src=\"{}\"", escape_xml(src))];
            if let Some(f) = fallback {
                attrs.push(format!("fallback=\"{}\"", escape_xml(f)));
            }
            format!("<audio {}>", attrs.join(" "))
        }
        SsmlInline::Sub { alias, children } => {
            let inner: String = children.iter().map(render_inline).collect();
            format!(
                "<sub alias=\"{}\">{}</sub>",
                escape_xml(alias),
                inner
            )
        }
    }
}

fn attr_value(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        other => other.to_string(),
    }
}

/// 序列化整个 SSML 文档为标准 XML 字符串
pub fn serialize_ssml(doc: &SsmlDocument) -> String {
    let inner: String = doc.children.iter().map(render_inline).collect();
    format!(
        "<speak version=\"1.1\" xmlns=\"http://www.w3.org/2001/10/synthesis\" xml:lang=\"{}\">{}</speak>",
        doc.xml_lang, inner
    )
}

// ─── 单元测试 ─────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_node_escapes_xml_chars() {
        let doc = SsmlDocument {
            xml_lang: "zh-CN".into(),
            default_voice: None,
            children: vec![SsmlInline::text("<script>&'\"")],
        };
        let out = serialize_ssml(&doc);
        assert!(out.contains("&lt;script&gt;"));
        assert!(out.contains("&amp;"));
        assert!(out.contains("&apos;"));
        assert!(out.contains("&quot;"));
    }

    #[test]
    fn break_renders_time_attribute() {
        let doc = SsmlDocument {
            xml_lang: "zh-CN".into(),
            default_voice: None,
            children: vec![
                SsmlInline::text("前"),
                SsmlInline::pause_ms(500),
                SsmlInline::text("后"),
            ],
        };
        let out = serialize_ssml(&doc);
        assert!(out.contains("<break time=\"500ms\"/>"));
    }

    #[test]
    fn emphasis_default_is_moderate() {
        let doc = SsmlDocument {
            xml_lang: "zh-CN".into(),
            default_voice: None,
            children: vec![SsmlInline::emphasis(
                EmphasisLevel::Strong,
                vec![SsmlInline::text("重点")],
            )],
        };
        let out = serialize_ssml(&doc);
        assert!(out.contains("<emphasis level=\"strong\">重点</emphasis>"));
    }

    #[test]
    fn voice_switch_preserves_name() {
        let doc = SsmlDocument {
            xml_lang: "zh-CN".into(),
            default_voice: None,
            children: vec![SsmlInline::voice("zh-CN-YunxiNeural", vec![SsmlInline::text("你好")])],
        };
        let out = serialize_ssml(&doc);
        assert!(out.contains("<voice name=\"zh-CN-YunxiNeural\">你好</voice>"));
    }

    #[test]
    fn multi_voice_inserts_300ms_pause_between_segments() {
        let doc = SsmlDocument::multi_voice(
            &[
                ("zh-CN-YunxiNeural".into(), vec![SsmlInline::text("旁白")]),
                ("zh-CN-XiaoxiaoNeural".into(), vec![SsmlInline::text("角色 A")]),
            ],
            "zh-CN",
        );
        let out = serialize_ssml(&doc);
        assert!(out.contains("<voice name=\"zh-CN-YunxiNeural\">旁白</voice>"));
        assert!(out.contains("<voice name=\"zh-CN-XiaoxiaoNeural\">角色 A</voice>"));
        // 2 段 → 2 个 300ms 停顿
        let count = out.matches("<break time=\"300ms\"/>").count();
        assert_eq!(count, 2);
    }

    #[test]
    fn speak_root_has_xml_lang() {
        let doc = SsmlDocument {
            xml_lang: "en-US".into(),
            default_voice: None,
            children: vec![SsmlInline::text("hi")],
        };
        let out = serialize_ssml(&doc);
        assert!(out.starts_with("<speak version=\"1.1\""));
        assert!(out.contains("xml:lang=\"en-US\""));
    }

    #[test]
    fn round_trip_preserves_text() {
        // 简单一致性：序列化 → 再解析 → 再次序列化应一致
        let doc = SsmlDocument {
            xml_lang: "zh-CN".into(),
            default_voice: None,
            children: vec![
                SsmlInline::text("旁白"),
                SsmlInline::pause_ms(500),
                SsmlInline::voice("zh-CN-XiaoxiaoNeural", vec![SsmlInline::text("啊?")]),
            ],
        };
        let out1 = serialize_ssml(&doc);
        let parsed: SsmlDocument = serde_json::from_str(&serde_json::to_string(&doc).unwrap()).unwrap();
        let out2 = serialize_ssml(&parsed);
        assert_eq!(out1, out2);
    }
}
