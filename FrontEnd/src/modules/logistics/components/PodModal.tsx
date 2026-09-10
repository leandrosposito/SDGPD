import { useEffect, useRef, useState, type FC, type PointerEvent as ReactPointerEvent } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import { EvidenceUploader } from '@/shared/components/ui/EvidenceUploader';
import { useEvidenceUpload } from '@/shared/hooks/useEvidenceUpload';
import { useSessionStore } from '@/shared/state/useSessionStore';
import { signUpload, confirmUpload } from '@/shared/api/uploads/uploads.service';
import type { TripId, DeliveryId, StopId } from '@/shared/types/ids.types';
import type { PodUbicacion } from '@/shared/types/pod.types';
import { registerPod } from '../services/trips.service';
import './PodModal.css';

// ============================================================
// PodModal — Proof of Delivery (Tanda 10B, ADR-010 seccion 7). Firma:
// canvas rasterizado a PNG, subido por el mismo pipeline que las fotos
// (uploads.service.ts) — sin dependencia nueva. Alternativa sin
// canvas: input de imagen (ADR-010 seccion 7, "si el dispositivo no
// soporta canvas"). Ubicacion: opcional, nunca bloqueante si se
// deniega.
//
// El trazo se captura con los props sinteticos de React
// (onPointerDown/Move/Up en el propio <canvas>), no con
// addEventListener manual — evita el riesgo de memory leak que
// preguntaria una autoauditoria adversarial (Fase C, pregunta 7): no
// hay listener que limpiar a mano, React gestiona el ciclo de vida del
// listener sintetico junto con el del elemento, y el <canvas> se
// desmonta/remonta en cada apertura del Modal (Modal.tsx retorna null
// mientras isOpen es false) sin dejar nada colgado.
//
// Idempotencia (ADR-010 seccion 4) + timestampDispositivo (ADR-010
// seccion 7): ambos se capturan al ABRIR el modal, no al confirmar —
// mismo patron de "ajuste durante el render" que ReprogramarModal.tsx/
// RegistrarEntregaModal.tsx.
// ============================================================

const CANVAS_WIDTH = 380;
const CANVAS_HEIGHT = 140;

interface PodModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: TripId;
  deliveryId: DeliveryId | null;
  stopId: StopId | null;
  fullName: string;
  onRegistered: () => void;
}

export const PodModal: FC<PodModalProps> = ({ isOpen, onClose, tripId, deliveryId, stopId, fullName, onRegistered }) => {
  const empresaId = useSessionStore((s) => s.session?.company.id) ?? '';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const hasStrokeRef = useRef(false);

  const [receptorNombre, setReceptorNombre] = useState('');
  const [receptorDocumento, setReceptorDocumento] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [ubicacion, setUbicacion] = useState<PodUbicacion | undefined>(undefined);
  const [capturandoUbicacion, setCapturandoUbicacion] = useState(false);
  const [firmaAlternativa, setFirmaAlternativa] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const evidence = useEvidenceUpload();

  // Ajuste durante el render: al abrir (para esta entrega u otra), se
  // resetean campos, la clave de idempotencia y el timestamp de
  // dispositivo en el mismo render extra que React descarta antes de
  // pintar.
  const openTrigger = isOpen ? `${deliveryId ?? ''}-${stopId ?? ''}` : null;
  const [lastOpenTrigger, setLastOpenTrigger] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [timestampDispositivo, setTimestampDispositivo] = useState('');
  if (openTrigger !== null && openTrigger !== lastOpenTrigger) {
    setLastOpenTrigger(openTrigger);
    setIdempotencyKey(crypto.randomUUID());
    setTimestampDispositivo(new Date().toISOString());
    setReceptorNombre('');
    setReceptorDocumento('');
    setObservaciones('');
    setUbicacion(undefined);
    setFirmaAlternativa(null);
    evidence.reset();
  }

  // Limpia el trazo (ref + canvas) en un efecto, no durante el render:
  // a diferencia del estado de arriba, un ref es explicitamente "fuera
  // del render" (react.dev/reference/react/useRef) — el compilador de
  // React 19 lo marca como error si se toca en el cuerpo del
  // componente. El canvas recien montado (Modal.tsx lo desmonta
  // mientras isOpen es false) ya existe para cuando este efecto corre.
  useEffect(() => {
    if (openTrigger === null) return;
    hasStrokeRef.current = false;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, [openTrigger]);

  if (!deliveryId || !stopId) return null;

  function getCanvasPoint(e: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    isDrawingRef.current = true;
    const { x, y } = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    hasStrokeRef.current = true;
  }

  function handlePointerUp() {
    isDrawingRef.current = false;
  }

  function handleClearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokeRef.current = false;
  }

  function handleCaptureLocation() {
    if (!navigator.geolocation) {
      toast.error('Este dispositivo no permite capturar ubicación.');
      return;
    }
    setCapturandoUbicacion(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy });
        setCapturandoUbicacion(false);
      },
      () => {
        // Nunca bloqueante si se deniega (ADR-010 seccion 7) — se avisa
        // y se sigue sin ubicacion.
        toast.error('No se pudo obtener la ubicación (¿permiso denegado?).');
        setCapturandoUbicacion(false);
      },
      { timeout: 8000 }
    );
  }

  async function uploadSignatureCanvas(): Promise<string> {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('No hay firma para subir.');
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen de la firma.'))), 'image/png');
    });
    const file = new File([blob], `firma-${deliveryId}.png`, { type: 'image/png' });
    const { fileId } = await signUpload(file.name, file.type);
    await confirmUpload(fileId, file);
    return fileId;
  }

  async function uploadAlternativeSignature(file: File): Promise<string> {
    const { fileId } = await signUpload(file.name, file.type);
    await confirmUpload(fileId, file);
    return fileId;
  }

  async function handleConfirm() {
    if (!receptorNombre.trim()) {
      toast.error('El nombre del receptor es obligatorio.');
      return;
    }
    if (!hasStrokeRef.current && !firmaAlternativa) {
      toast.error('Falta la firma (dibujada o como imagen).');
      return;
    }
    if (evidence.isUploading) {
      toast.error('Esperá a que terminen de subirse las imágenes adicionales.');
      return;
    }
    if (evidence.hasErrors) {
      toast.error('Hay imágenes con error — reintentalas o quitalas antes de confirmar.');
      return;
    }
    if (!idempotencyKey || !deliveryId || !stopId) return;

    setIsSaving(true);
    try {
      const firmaEvidenciaId = firmaAlternativa ? await uploadAlternativeSignature(firmaAlternativa) : await uploadSignatureCanvas();

      const result = await registerPod(
        empresaId,
        idempotencyKey,
        tripId,
        deliveryId,
        stopId,
        {
          receptor: { nombre: receptorNombre.trim(), documento: receptorDocumento.trim() || undefined, contactId: null },
          firmaEvidenciaId,
          imagenesIds: evidence.uploadedFileIds,
          ubicacion,
          observaciones: observaciones.trim() || undefined,
          timestampDispositivo,
        },
        fullName
      );

      if (result.success && result.trip) {
        if (result.deliveryFinalized) {
          toast.success('POD registrado correctamente.');
        } else {
          // Fase C: el POD quedo guardado (hecho fisico ya ocurrido),
          // pero la entrega no se pudo marcar Finalizada automaticamente
          // (ej. todavia esta en Creada, nunca salio En Ruta) — se avisa
          // en vez de reportar exito completo en silencio.
          toast.warning(`POD registrado, pero la entrega ${deliveryId} no se pudo marcar Finalizada automáticamente — revisala en Logística.`, {
            duration: 8000,
          });
        }
        onRegistered();
        onClose();
        return;
      }
      toast.error('No se pudo registrar el POD.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo registrar el POD.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Registrar POD — ${deliveryId}`}
      size="md"
      footer={
        <>
          <button type="button" className="pod-modal__cancel" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button type="button" className="pod-modal__confirm" onClick={handleConfirm} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Confirmar POD'}
          </button>
        </>
      }
    >
      <div className="pod-modal">
        <div className="pod-modal__field">
          <label>Receptor</label>
          <input type="text" value={receptorNombre} onChange={(e) => setReceptorNombre(e.target.value)} placeholder="Nombre de quien recibe" />
        </div>
        <div className="pod-modal__field">
          <label>Documento (opcional)</label>
          <input type="text" value={receptorDocumento} onChange={(e) => setReceptorDocumento(e.target.value)} placeholder="DNI" />
        </div>

        <div className="pod-modal__field">
          <label>Firma</label>
          {!firmaAlternativa ? (
            <>
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="pod-modal__canvas"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
              <div className="pod-modal__signature-actions">
                <button type="button" onClick={handleClearSignature}>
                  Limpiar firma
                </button>
                <label className="pod-modal__alt-signature-label">
                  ¿No podés firmar en pantalla? Subir imagen
                  <input type="file" accept="image/*" onChange={(e) => setFirmaAlternativa(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            </>
          ) : (
            <div className="pod-modal__signature-actions">
              <span>{firmaAlternativa.name}</span>
              <button type="button" onClick={() => setFirmaAlternativa(null)}>
                Usar canvas en su lugar
              </button>
            </div>
          )}
        </div>

        <div className="pod-modal__field">
          <label>Observaciones</label>
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
        </div>

        <div className="pod-modal__field">
          <button type="button" onClick={handleCaptureLocation} disabled={capturandoUbicacion}>
            {capturandoUbicacion ? 'Capturando…' : ubicacion ? 'Ubicación capturada ✓' : 'Capturar ubicación'}
          </button>
        </div>

        <EvidenceUploader
          files={evidence.files}
          rejectedMessages={evidence.rejectedMessages}
          onAddFiles={evidence.addFiles}
          onRetry={evidence.retry}
          onRemove={evidence.remove}
        />
      </div>
    </Modal>
  );
};
