/**
 * LegalPage — Terms of Service + Privacy Policy
 * Static content page; no auth required.
 */
import { useState } from "react";
import { CyberButton } from "../components/CyberButton";

type LegalTab = "tos" | "privacy" | "rules";

interface Props {
  onNav?: (page: string) => void;
}

const SECTION: React.CSSProperties = { marginTop: 24, paddingTop: 16, borderTop: "1px solid #1e1e2e" };
const H2: React.CSSProperties = { fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 6, letterSpacing: "0.08em" };
const P: React.CSSProperties = { fontFamily: "monospace", fontSize: 11, color: "#64748b", lineHeight: 1.7, marginBottom: 8 };
const LI: React.CSSProperties = { fontFamily: "monospace", fontSize: 11, color: "#64748b", lineHeight: 1.7, marginBottom: 4 };

const LAST_UPDATED = "July 10, 2026";

export function LegalPage({ onNav }: Props) {
  const [tab, setTab] = useState<LegalTab>("rules");

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, padding: "16px 20px" }}>
        <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: "#e2e8f0", letterSpacing: "0.05em" }}>
          ⚖ LEGAL & COMMUNITY
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: "#334155", marginTop: 4 }}>
          Last updated: {LAST_UPDATED}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2">
        {(["rules", "tos", "privacy"] as LegalTab[]).map(t => (
          <CyberButton key={t} variant={tab === t ? "primary" : "ghost"} size="sm" onClick={() => setTab(t)}>
            {t === "rules" ? "Community Rules" : t === "tos" ? "Terms of Service" : "Privacy Policy"}
          </CyberButton>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, padding: "20px 24px" }}>

        {/* ── COMMUNITY RULES ── */}
        {tab === "rules" && (
          <>
            <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#00d4ff", letterSpacing: "0.08em" }}>
              COMMUNITY RULES
            </div>
            <p style={P}>These rules apply in all public chat channels (Global, District, Faction) and in all player interactions. Violations are handled by our Vanta moderation system and staff team.</p>

            <div style={SECTION}>
              <div style={H2}>1. RESPECT & CONDUCT</div>
              <ul style={{ paddingLeft: 16 }}>
                <li style={LI}>Treat all players with basic respect. Targeted harassment, personal attacks, and hate speech are not tolerated.</li>
                <li style={LI}>No threats — real or implied — against any person inside or outside the game.</li>
                <li style={LI}>No discrimination based on race, ethnicity, religion, gender, sexual orientation, disability, or national origin.</li>
                <li style={LI}>Disagreements with staff decisions must be handled through the <span style={{ color: "#00d4ff", cursor: "pointer" }} onClick={() => onNav?.("support")}>Support</span> system, not in public chat.</li>
              </ul>
            </div>

            <div style={SECTION}>
              <div style={H2}>2. CHAT CONDUCT</div>
              <ul style={{ paddingLeft: 16 }}>
                <li style={LI}>No NSFW, explicit, or sexually suggestive content in any public channel.</li>
                <li style={LI}>No spamming — repeated messages, excessive symbols, or flooding the chat.</li>
                <li style={LI}>No advertising other games, services, or external links.</li>
                <li style={LI}>English is the primary language for Global chat. District and Faction chats may use any language.</li>
              </ul>
            </div>

            <div style={SECTION}>
              <div style={H2}>3. FAIR PLAY</div>
              <ul style={{ paddingLeft: 16 }}>
                <li style={LI}>No exploiting game bugs or unintended mechanics for personal gain. Report bugs via <span style={{ color: "#00d4ff", cursor: "pointer" }} onClick={() => onNav?.("support")}>Support</span>.</li>
                <li style={LI}>No use of automation, bots, scripts, or any third-party tools to gain an advantage.</li>
                <li style={LI}>One account per player. Multiple accounts (alt accounts) will be banned.</li>
                <li style={LI}>Do not sell, trade, or share account access with other players.</li>
              </ul>
            </div>

            <div style={SECTION}>
              <div style={H2}>4. ENFORCEMENT</div>
              <ul style={{ paddingLeft: 16 }}>
                <li style={LI}><span style={{ color: "#f59e0b" }}>Warning</span> — first offense for minor violations.</li>
                <li style={LI}><span style={{ color: "#ff6b35" }}>Mute</span> — temporary loss of chat privileges (minutes to days).</li>
                <li style={LI}><span style={{ color: "#ff2d55" }}>Temporary Ban</span> — loss of game access for 24 hours to 30 days.</li>
                <li style={LI}><span style={{ color: "#ff2d55", fontWeight: 700 }}>Permanent Ban</span> — severe or repeated violations, cheating, or multi-accounting.</li>
              </ul>
              <p style={{ ...P, marginTop: 8 }}>Appeal bans through <span style={{ color: "#00d4ff", cursor: "pointer" }} onClick={() => onNav?.("support")}>Support → Appeal</span> within 7 days. Staff decisions are final after review.</p>
            </div>
          </>
        )}

        {/* ── TERMS OF SERVICE ── */}
        {tab === "tos" && (
          <>
            <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#00d4ff", letterSpacing: "0.08em" }}>
              TERMS OF SERVICE
            </div>
            <p style={P}>By accessing or playing DriftLife, you agree to these Terms. If you do not agree, do not use the service.</p>

            <div style={SECTION}>
              <div style={H2}>1. ELIGIBILITY</div>
              <p style={P}>You must be at least 13 years old to use DriftLife. Players under 18 require parental consent. By creating an account, you confirm you meet the age requirement.</p>
            </div>

            <div style={SECTION}>
              <div style={H2}>2. ACCOUNTS</div>
              <p style={P}>You are responsible for maintaining the security of your account credentials. DriftLife staff will never ask for your password. One player may hold only one account. We reserve the right to terminate accounts that violate our rules.</p>
            </div>

            <div style={SECTION}>
              <div style={H2}>3. VIRTUAL CURRENCY & ITEMS</div>
              <p style={P}>DriftCoins (DC) and Nova Credits (NC) are virtual currencies with no real-world monetary value. Items, currencies, and progress are owned by DriftLife and licensed to you for use within the game. We reserve the right to modify, remove, or rebalance any in-game item or currency at any time.</p>
              <p style={P}>Nova Credits purchased via real-money transactions (Telegram Stars or subscription) are non-refundable once consumed. Unused NC may be subject to refund within 14 days as required by applicable law.</p>
            </div>

            <div style={SECTION}>
              <div style={H2}>4. PROHIBITED CONDUCT</div>
              <p style={P}>You may not: reverse engineer, decompile, or disassemble any part of DriftLife; use automated tools, bots, or scripts; exploit bugs for game advantage; harass, stalk, or threaten other players; attempt to access systems or data beyond your account; impersonate DriftLife staff.</p>
            </div>

            <div style={SECTION}>
              <div style={H2}>5. INTELLECTUAL PROPERTY</div>
              <p style={P}>All DriftLife content — including art, music, code, characters, and lore — is owned by DriftLife. You may not reproduce or distribute it without written permission. You retain ownership of original content you create, but grant DriftLife a perpetual license to use it within the game.</p>
            </div>

            <div style={SECTION}>
              <div style={H2}>6. LIMITATION OF LIABILITY</div>
              <p style={P}>DriftLife is provided "as is." We are not liable for any indirect, incidental, or consequential damages arising from your use of the service. Our total liability is limited to the amount you paid in the last 3 months.</p>
            </div>

            <div style={SECTION}>
              <div style={H2}>7. CHANGES TO TERMS</div>
              <p style={P}>We may update these Terms at any time. Continued use of the game after changes are posted constitutes acceptance of the new Terms. Material changes will be announced via in-game Patch Notes.</p>
            </div>
          </>
        )}

        {/* ── PRIVACY POLICY ── */}
        {tab === "privacy" && (
          <>
            <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#00d4ff", letterSpacing: "0.08em" }}>
              PRIVACY POLICY
            </div>
            <p style={P}>This policy describes how DriftLife collects, uses, and protects your data.</p>

            <div style={SECTION}>
              <div style={H2}>1. DATA WE COLLECT</div>
              <ul style={{ paddingLeft: 16 }}>
                <li style={LI}><span style={{ color: "#e2e8f0" }}>Account data</span> — username, email address, hashed password, registration date.</li>
                <li style={LI}><span style={{ color: "#e2e8f0" }}>Gameplay data</span> — in-game actions, progress, statistics, chat messages.</li>
                <li style={LI}><span style={{ color: "#e2e8f0" }}>Connection data</span> — IP addresses, login timestamps. Used solely for security and alt-account detection.</li>
                <li style={LI}><span style={{ color: "#e2e8f0" }}>Linked platforms</span> — Telegram user ID (if you link your account). We do not receive your Telegram password.</li>
              </ul>
            </div>

            <div style={SECTION}>
              <div style={H2}>2. HOW WE USE YOUR DATA</div>
              <ul style={{ paddingLeft: 16 }}>
                <li style={LI}>To operate and improve the game service.</li>
                <li style={LI}>To enforce our Community Rules and Terms of Service.</li>
                <li style={LI}>To detect fraud, cheating, and multiple accounts.</li>
                <li style={LI}>To send in-game notifications and respond to support tickets.</li>
              </ul>
            </div>

            <div style={SECTION}>
              <div style={H2}>3. DATA SHARING</div>
              <p style={P}>We do not sell your personal data. We may share data with service providers who help us operate the game (database hosting, error monitoring) under strict confidentiality agreements. We may disclose data when required by law.</p>
            </div>

            <div style={SECTION}>
              <div style={H2}>4. DATA RETENTION</div>
              <p style={P}>Account data is retained while your account is active. Chat messages expire after 30 days. If you delete your account, personal data is removed within 30 days. Aggregated anonymised statistics may be retained indefinitely.</p>
            </div>

            <div style={SECTION}>
              <div style={H2}>5. YOUR RIGHTS</div>
              <ul style={{ paddingLeft: 16 }}>
                <li style={LI}>Access and export your account data via <span style={{ color: "#00d4ff", cursor: "pointer" }} onClick={() => onNav?.("settings")}>Settings</span>.</li>
                <li style={LI}>Request deletion of your account and personal data via <span style={{ color: "#00d4ff", cursor: "pointer" }} onClick={() => onNav?.("support")}>Support</span>.</li>
                <li style={LI}>Correct inaccurate data via account settings or a support ticket.</li>
              </ul>
            </div>

            <div style={SECTION}>
              <div style={H2}>6. SECURITY</div>
              <p style={P}>Passwords are hashed using bcrypt and never stored in plaintext. All communication is encrypted in transit (TLS). Staff cannot view your password. If you suspect your account was compromised, change your password immediately and contact support.</p>
            </div>

            <div style={SECTION}>
              <div style={H2}>7. CONTACT</div>
              <p style={P}>For privacy-related requests, open a <span style={{ color: "#00d4ff", cursor: "pointer" }} onClick={() => onNav?.("support")}>Support ticket</span> with category "Account".</p>
            </div>
          </>
        )}
      </div>

      {/* Footer nav */}
      <div className="flex gap-3 justify-center flex-wrap pb-4">
        {onNav && (
          <>
            <CyberButton variant="ghost" size="sm" onClick={() => onNav("support")}>Contact Support</CyberButton>
            <CyberButton variant="ghost" size="sm" onClick={() => onNav("report-player")}>Report a Player</CyberButton>
          </>
        )}
      </div>
    </div>
  );
}
