import { useState } from 'react';
import { Button } from './Button';

const CATEGORIES = [
  { value: 'feature', label: 'Nouvelle feature' },
  { value: 'ux', label: 'UX / Interface' },
  { value: 'bug', label: 'Bug' },
  { value: 'autre', label: 'Autre' },
] as const;

type Category = typeof CATEGORIES[number]['value'];

interface FeedbackDrawerProps {
  onClose: () => void;
}

export function FeedbackDrawer({ onClose }: FeedbackDrawerProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('feature');
  const [description, setDescription] = useState('');
  const [sent, setSent] = useState(false);

  function handleSubmit() {
    const catLabel = CATEGORIES.find((c) => c.value === category)?.label ?? category;
    const subject = encodeURIComponent(`[GTM Manager] ${catLabel} — ${title}`);
    const body = encodeURIComponent(
      `Catégorie : ${catLabel}\n\nTitre : ${title}\n\nDescription :\n${description}\n\n---\nEnvoyé depuis DK GTM Manager`
    );
    window.open(`mailto:googlepartner@digitalkeys.fr?subject=${subject}&body=${body}`, '_self');
    setSent(true);
  }

  const canSubmit = title.trim().length > 0 && description.trim().length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'hsl(220 20% 10% / 0.35)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-drawer-title"
        style={{
          width: 420,
          backgroundColor: 'hsl(0 0% 100%)',
          borderLeft: '1px solid hsl(220 13% 91%)',
          boxShadow: '-4px 0 24px hsl(220 20% 10% / 0.08)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid hsl(220 13% 91%)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, hsl(267 100% 59%), hsl(283 100% 11%))' }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1.5C3.74 1.5 1.5 3.74 1.5 6.5c0 .9.23 1.75.63 2.5L1.5 11.5l2.5-.63A5 5 0 1011.5 6.5C11.5 3.74 9.26 1.5 6.5 1.5z" stroke="white" strokeWidth="1.2" strokeLinejoin="round"/>
                <path d="M4.5 6.5h4M4.5 8.5h2.5" stroke="white" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div id="feedback-drawer-title" className="text-sm font-semibold text-foreground leading-none">Proposer une amélioration</div>
              <div className="text-xs text-muted-fg mt-0.5">GTM Manager</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-fg hover:bg-muted hover:text-foreground transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {sent ? (
          /* Success state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'hsl(142 70% 45% / 0.12)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l5 5L19 7" stroke="hsl(142 70% 45%)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Merci pour votre suggestion !</div>
              <div className="text-xs text-muted-fg mt-1">Votre client mail s'est ouvert avec le message pré-rempli.</div>
            </div>
            <Button variant="secondary" size="sm" onClick={onClose}>Fermer</Button>
          </div>
        ) : (
          /* Form */
          <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">

            {/* Catégorie */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-foreground">Catégorie</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                    style={
                      category === c.value
                        ? {
                            backgroundColor: 'hsl(267 100% 59% / 0.1)',
                            borderColor: 'hsl(267 100% 59% / 0.4)',
                            color: 'hsl(267 100% 59%)',
                          }
                        : {
                            backgroundColor: 'transparent',
                            borderColor: 'hsl(220 13% 88%)',
                            color: 'hsl(220 10% 50%)',
                          }
                    }
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Titre */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="feedback-title" className="text-xs font-semibold text-foreground">
                Titre <span style={{ color: 'hsl(267 100% 59%)' }}>*</span>
              </label>
              <input
                id="feedback-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex : Ajouter un filtre par type de tag dans la matrice"
                maxLength={100}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors"
                style={{
                  borderColor: title.length > 0 ? 'hsl(267 100% 59% / 0.4)' : 'hsl(220 13% 88%)',
                  backgroundColor: 'hsl(220 20% 98%)',
                  color: 'hsl(220 15% 15%)',
                }}
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="feedback-description" className="text-xs font-semibold text-foreground">
                Description <span style={{ color: 'hsl(267 100% 59%)' }}>*</span>
              </label>
              <textarea
                id="feedback-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez le besoin, le contexte, et l'impact attendu..."
                rows={6}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors resize-none"
                style={{
                  borderColor: description.length > 0 ? 'hsl(267 100% 59% / 0.4)' : 'hsl(220 13% 88%)',
                  backgroundColor: 'hsl(220 20% 98%)',
                  color: 'hsl(220 15% 15%)',
                  lineHeight: '1.6',
                }}
              />
            </div>

            {/* Info */}
            <div
              className="flex items-start gap-2.5 px-3 py-3 rounded-lg text-xs"
              style={{ backgroundColor: 'hsl(220 20% 97%)', color: 'hsl(220 10% 50%)' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-px">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.25"/>
                <path d="M7 6v4M7 4.5v.01" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
              Un email pré-rempli s'ouvrira dans votre client mail. Envoyez-le pour soumettre votre suggestion.
            </div>
          </div>
        )}

        {/* Footer */}
        {!sent && (
          <div
            className="px-5 py-4 flex items-center justify-between shrink-0"
            style={{ borderTop: '1px solid hsl(220 13% 91%)' }}
          >
            <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M1.5 6.5L11.5 1.5l-5 10-1.5-4.5L1.5 6.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
              Envoyer la suggestion
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
