import React, { useState, useRef } from 'react';
import { 
  Building, 
  Car, 
  Gem, 
  FileText, 
  Plus, 
  Trash2, 
  X, 
  MapPin, 
  CheckCircle2, 
  Lock,
  Calendar,
  Upload,
  Download,
  Eye,
  Edit2,
  FileCheck,
  AlertCircle,
  Shield,
  ShieldAlert,
  Loader2,
  Search,
  ExternalLink
} from 'lucide-react';
import { VaultState, PropertyItem, VehicleItem, ValuableAsset, DocumentItem, DocumentCategory } from '../../types';
import { storageService } from '../../services/storage';

interface MobileImportantScreenProps {
  state: VaultState;
  initialSubtab?: string;
}

type ImportantTab = 'properties' | 'vehicles' | 'valuables' | 'documents';

const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'Identity Proof',
  'Insurance',
  'Property',
  'Vehicle',
  'Medical',
  'Financial',
  'Other',
];

export const MobileImportantScreen: React.FC<MobileImportantScreenProps> = ({
  state,
  initialSubtab = 'properties',
}) => {
  const [subtab, setSubtab] = useState<ImportantTab>(
    (initialSubtab as ImportantTab) || 'properties'
  );

  const [modalType, setModalType] = useState<'NONE' | 'PROPERTY' | 'VEHICLE' | 'VALUABLE' | 'DOCUMENT'>('NONE');

  // Safe arrays
  const properties = state?.properties || [];
  const vehicles = state?.vehicles || [];
  const valuableAssets = state?.valuableAssets || [];
  const documents = state?.documents || [];

  // Property Form State
  const [propCategory, setPropCategory] = useState<'PROPERTY' | 'HOUSE' | 'LAND'>('HOUSE');
  const [propName, setPropName] = useState('');
  const [propLocation, setPropLocation] = useState('');
  const [propOwnership, setPropOwnership] = useState<'SOLE_OWNER' | 'JOINT_OWNER' | 'INHERITED' | 'MORTGAGED'>('SOLE_OWNER');
  const [propValue, setPropValue] = useState('');
  const [propDetails, setPropDetails] = useState('');

  // Vehicle Form State
  const [vehType, setVehType] = useState<'CAR' | 'TWO_WHEELER' | 'COMMERCIAL' | 'ELECTRIC' | 'OTHER'>('CAR');
  const [vehBrand, setVehBrand] = useState('');
  const [vehModel, setVehModel] = useState('');
  const [vehRegNo, setVehRegNo] = useState('');
  const [vehInsuranceExp, setVehInsuranceExp] = useState('');

  // Valuable Asset Form State
  const [valName, setValName] = useState('');
  const [valCategory, setValCategory] = useState<'GOLD' | 'JEWELRY' | 'DIAMONDS' | 'PRECIOUS_STONES' | 'SILVER' | 'HEIRLOOM' | 'OTHER'>('GOLD');
  const [valEstimated, setValEstimated] = useState('');
  const [valWeight, setValWeight] = useState('');
  const [valLocation, setValLocation] = useState('');

  // -------------------------------------------------------------
  // IMPORTANT DOCUMENTS VAULT STATE
  // -------------------------------------------------------------
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState<DocumentCategory>('Identity Proof');
  const [docDescription, setDocDescription] = useState('');
  // STRICT REQUIREMENT: Permission must be OFF by default!
  const [docAllowNomineeAccess, setDocAllowNomineeAccess] = useState<boolean>(false);

  // Upload Status & Progress
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState('');
  const [uploadErrorMessage, setUploadErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Document Management Modals
  const [viewingDoc, setViewingDoc] = useState<DocumentItem | null>(null);
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<DocumentItem | null>(null);
  const [docCategoryFilter, setDocCategoryFilter] = useState<string>('ALL');
  const [docSearchQuery, setDocSearchQuery] = useState<string>('');
  const [docActionError, setDocActionError] = useState<string>('');

  // -------------------------------------------------------------
  // PROPERTY, VEHICLE, VALUABLE HANDLERS
  // -------------------------------------------------------------
  const handleSaveProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propName.trim() || !propLocation.trim()) return;

    const item: PropertyItem = {
      id: `prop-${Date.now()}`,
      category: propCategory,
      name: propName.trim(),
      property_type: propCategory,
      location: propLocation.trim(),
      ownership: propOwnership,
      estimated_value: parseFloat(propValue) || 0,
      notes: propDetails.trim(),
      created_at: new Date().toISOString(),
    };

    storageService.updateState((prev) => ({
      ...prev,
      properties: [item, ...prev.properties],
    }));
    storageService.logAudit('ADD_PROPERTY', state.user?.full_name || 'Owner', `Added ${propCategory}: ${propName}`);

    setPropName('');
    setPropLocation('');
    setPropValue('');
    setPropDetails('');
    setModalType('NONE');
  };

  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehBrand.trim() || !vehRegNo.trim()) return;

    const item: VehicleItem = {
      id: `veh-${Date.now()}`,
      vehicle_type: vehType,
      brand: vehBrand.trim(),
      model: vehModel.trim(),
      registration_number: vehRegNo.trim().toUpperCase(),
      insurance_expiry: vehInsuranceExp,
      created_at: new Date().toISOString(),
    };

    storageService.updateState((prev) => ({
      ...prev,
      vehicles: [item, ...prev.vehicles],
    }));
    storageService.logAudit('ADD_VEHICLE', state.user?.full_name || 'Owner', `Added ${vehBrand} ${vehModel}`);

    setVehBrand('');
    setVehModel('');
    setVehRegNo('');
    setVehInsuranceExp('');
    setModalType('NONE');
  };

  const handleSaveValuable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valName.trim()) return;

    const item: ValuableAsset = {
      id: `val-${Date.now()}`,
      name: valName.trim(),
      category: valCategory,
      estimated_value: parseFloat(valEstimated) || 0,
      weight_grams: parseFloat(valWeight) || undefined,
      location_stored: valLocation.trim(),
      created_at: new Date().toISOString(),
    };

    storageService.updateState((prev) => ({
      ...prev,
      valuableAssets: [item, ...prev.valuableAssets],
    }));
    storageService.logAudit('ADD_VALUABLE_ASSET', state.user?.full_name || 'Owner', `Added ${valCategory}: ${valName}`);

    setValName('');
    setValEstimated('');
    setValWeight('');
    setValLocation('');
    setModalType('NONE');
  };

  const handleDeleteItem = (category: 'PROP' | 'VEH' | 'VAL', id: string) => {
    storageService.updateState((prev) => {
      switch (category) {
        case 'PROP':
          return { ...prev, properties: prev.properties.filter((p) => p.id !== id) };
        case 'VEH':
          return { ...prev, vehicles: prev.vehicles.filter((v) => v.id !== id) };
        case 'VAL':
          return { ...prev, valuableAssets: prev.valuableAssets.filter((va) => va.id !== id) };
        default:
          return prev;
      }
    });
  };

  // -------------------------------------------------------------
  // DOCUMENT VAULT ACTIONS (REAL BACKEND STORAGE)
  // -------------------------------------------------------------

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadErrorMessage('');
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['pdf', 'jpg', 'jpeg', 'png'];

    if (!validTypes.includes(file.type) && !validExts.includes(ext || '')) {
      setUploadErrorMessage('Invalid format. Only PDF, JPG, JPEG, and PNG files are supported.');
      setDocFile(null);
      return;
    }

    // Validate size (15MB)
    if (file.size > 15 * 1024 * 1024) {
      setUploadErrorMessage('File size exceeds the 15MB maximum limit.');
      setDocFile(null);
      return;
    }

    setDocFile(file);
    // Autofill name from file if empty
    if (!docName.trim()) {
      const cleanBaseName = file.name.replace(/\.[^/.]+$/, '');
      setDocName(cleanBaseName);
    }
  };

  const handleUploadDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadErrorMessage('');
    setUploadSuccessMessage('');

    if (!docFile) {
      setUploadErrorMessage('Please select a file to upload (PDF, JPG, JPEG, or PNG).');
      return;
    }
    if (!docName.trim()) {
      setUploadErrorMessage('Document name is required.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    const progressTimer = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 15 : prev));
    }, 150);

    try {
      const result = await storageService.uploadDocument(docFile, {
        title: docName.trim(),
        category: docCategory,
        description: docDescription.trim(),
        allowNomineeEmergencyAccess: docAllowNomineeAccess,
      });

      clearInterval(progressTimer);
      setUploadProgress(100);

      if (!result.success) {
        setIsUploading(false);
        setUploadErrorMessage(result.error || 'Failed to upload document.');
        return;
      }

      setIsUploading(false);
      setUploadSuccessMessage('Document saved successfully');

      setTimeout(() => {
        // Reset form
        setDocFile(null);
        setDocName('');
        setDocCategory('Identity Proof');
        setDocDescription('');
        setDocAllowNomineeAccess(false);
        setUploadProgress(0);
        setUploadSuccessMessage('');
        setModalType('NONE');
      }, 1200);
    } catch (err: any) {
      clearInterval(progressTimer);
      setIsUploading(false);
      setUploadErrorMessage(err.message || 'An error occurred during file upload.');
    }
  };

  const handleEditDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;
    setDocActionError('');

    try {
      const res = await storageService.updateDocumentMetadata(editingDoc.id, {
        title: editingDoc.title,
        category: editingDoc.category,
        description: editingDoc.description || '',
        allow_nominee_emergency_access: editingDoc.allow_nominee_emergency_access,
      });

      if (res.success) {
        setEditingDoc(null);
      } else {
        setDocActionError(res.error || 'Failed to update document metadata');
      }
    } catch (err: any) {
      setDocActionError(err.message || 'Error updating document');
    }
  };

  const handleConfirmDeleteDocument = async () => {
    if (!deletingDoc) return;
    setDocActionError('');

    try {
      const res = await storageService.deleteDocument(deletingDoc.id);
      if (res.success) {
        setDeletingDoc(null);
      } else {
        setDocActionError(res.error || 'Failed to delete document from vault');
      }
    } catch (err: any) {
      setDocActionError(err.message || 'Error deleting document');
    }
  };

  const formatFileSize = (bytes?: number, kb?: number): string => {
    if (bytes) {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (kb) {
      if (kb < 1024) return `${kb} KB`;
      return `${(kb / 1024).toFixed(1)} MB`;
    }
    return 'Document';
  };

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesCategory =
      docCategoryFilter === 'ALL' || (doc.category || '').toLowerCase() === docCategoryFilter.toLowerCase();
    const matchesSearch =
      docSearchQuery === '' ||
      (doc.title || '').toLowerCase().includes(docSearchQuery.toLowerCase()) ||
      (doc.description || '').toLowerCase().includes(docSearchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="p-4 space-y-4">
      {/* Header and Subtabs */}
      <div className="flex items-center justify-between pb-1">
        <div>
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
            LIFORA Estate & Assets
          </span>
          <h2 className="text-base font-extrabold text-stone-900 tracking-tight">
            Valuables & Documents
          </h2>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
        <button
          onClick={() => setSubtab('properties')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
            subtab === 'properties'
              ? 'bg-stone-900 text-white shadow-xs font-bold'
              : 'bg-white border border-stone-200 text-stone-600'
          }`}
        >
          Properties ({properties.length})
        </button>

        <button
          onClick={() => setSubtab('vehicles')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
            subtab === 'vehicles'
              ? 'bg-stone-900 text-white shadow-xs font-bold'
              : 'bg-white border border-stone-200 text-stone-600'
          }`}
        >
          Vehicles ({vehicles.length})
        </button>

        <button
          onClick={() => setSubtab('valuables')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
            subtab === 'valuables'
              ? 'bg-stone-900 text-white shadow-xs font-bold'
              : 'bg-white border border-stone-200 text-stone-600'
          }`}
        >
          Valuables ({valuableAssets.length})
        </button>

        <button
          onClick={() => setSubtab('documents')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
            subtab === 'documents'
              ? 'bg-emerald-900 text-white shadow-xs font-bold'
              : 'bg-white border border-stone-200 text-stone-600'
          }`}
        >
          Documents Vault ({documents.length})
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. PROPERTIES SUBTAB */}
      {/* ------------------------------------------------------------- */}
      {subtab === 'properties' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Registered Real Estate
            </h3>
            <button
              onClick={() => setModalType('PROPERTY')}
              className="py-1.5 px-3 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold flex items-center gap-1 shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Property</span>
            </button>
          </div>

          {properties.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-dashed border-stone-300 text-center">
              <Building className="w-8 h-8 text-stone-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-stone-800">No properties registered</p>
              <p className="text-[11px] text-stone-500 mt-1 max-w-xs mx-auto">
                Keep an uncompromised catalog of your houses, land, and commercial properties.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {properties.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-2xl bg-white border border-stone-200 flex items-start justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center shrink-0">
                      <Building className="w-4 h-4 text-emerald-800" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-stone-900">{p.name}</h4>
                        <span className="text-[10px] text-stone-500">· {p.category}</span>
                      </div>
                      <p className="text-[11px] text-stone-600 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-stone-400" />
                        <span>{p.location}</span>
                      </p>
                      {p.estimated_value > 0 && (
                        <p className="text-[11px] font-semibold text-stone-900 font-mono mt-1">
                          Est. Value: ₹{p.estimated_value.toLocaleString('en-IN')}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteItem('PROP', p.id)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. VEHICLES SUBTAB */}
      {/* ------------------------------------------------------------- */}
      {subtab === 'vehicles' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Registered Vehicles
            </h3>
            <button
              onClick={() => setModalType('VEHICLE')}
              className="py-1.5 px-3 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold flex items-center gap-1 shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Vehicle</span>
            </button>
          </div>

          {vehicles.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-dashed border-stone-300 text-center">
              <Car className="w-8 h-8 text-stone-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-stone-800">No vehicles logged</p>
              <p className="text-[11px] text-stone-500 mt-1 max-w-xs mx-auto">
                Record your cars, two-wheelers, and commercial vehicles with RC details.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  className="p-3.5 rounded-2xl bg-white border border-stone-200 flex items-start justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center shrink-0">
                      <Car className="w-4 h-4 text-emerald-800" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-stone-900">
                          {v.brand} {v.model}
                        </h4>
                        <span className="text-[10px] text-stone-500 font-mono font-bold">
                          {v.registration_number}
                        </span>
                      </div>
                      {v.insurance_expiry && (
                        <p className="text-[10px] text-stone-500 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-stone-400" />
                          <span>Insurance Exp: {v.insurance_expiry}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteItem('VEH', v.id)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. VALUABLES SUBTAB */}
      {/* ------------------------------------------------------------- */}
      {subtab === 'valuables' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Gold, Jewelry & Valuables
            </h3>
            <button
              onClick={() => setModalType('VALUABLE')}
              className="py-1.5 px-3 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold flex items-center gap-1 shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Asset</span>
            </button>
          </div>

          {valuableAssets.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-dashed border-stone-300 text-center">
              <Gem className="w-8 h-8 text-stone-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-stone-800">No valuable assets listed</p>
              <p className="text-[11px] text-stone-500 mt-1 max-w-xs mx-auto">
                Securely document gold ornaments, heirloom jewelry, and bank locker locations.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {valuableAssets.map((val) => (
                <div
                  key={val.id}
                  className="p-3.5 rounded-2xl bg-white border border-stone-200 flex items-start justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
                      <Gem className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-stone-900">{val.name}</h4>
                        <span className="text-[10px] text-stone-500">· {val.category}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-stone-600">
                        {val.weight_grams && <span>{val.weight_grams}g</span>}
                        {val.estimated_value > 0 && (
                          <span className="font-semibold text-stone-900">
                            · ₹{val.estimated_value.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      {val.location_stored && (
                        <p className="text-[10px] text-stone-400 mt-1 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-stone-400" />
                          <span>Locker: {val.location_stored}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteItem('VAL', val.id)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. IMPORTANT DOCUMENTS — GOOGLE DRIVE-STYLE SECURE VAULT */}
      {/* ------------------------------------------------------------- */}
      {subtab === 'documents' && (
        <div className="space-y-3.5">
          {/* Header Action Bar */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-800" />
                <span>Important Documents</span>
              </h3>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Private cloud document storage with controlled nominee emergency access.
              </p>
            </div>
            <button
              onClick={() => {
                setDocFile(null);
                setDocName('');
                setDocCategory('Identity Proof');
                setDocDescription('');
                setDocAllowNomineeAccess(false);
                setUploadErrorMessage('');
                setUploadSuccessMessage('');
                setModalType('DOCUMENT');
              }}
              className="py-2 px-3.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Document</span>
            </button>
          </div>

          {/* Quick Filter & Search Bar */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                placeholder="Search documents by name or notes..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-700 shadow-xs"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px]">
              {['ALL', ...DOCUMENT_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setDocCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                    docCategoryFilter === cat
                      ? 'bg-emerald-950 text-white font-bold'
                      : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Documents Grid / List */}
          {documents.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-dashed border-stone-300 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6 text-stone-400" />
              </div>
              <p className="text-xs font-bold text-stone-800">
                No documents uploaded yet. Upload your important documents securely.
              </p>
              <p className="text-[11px] text-stone-500 max-w-xs mx-auto">
                Safeguard legal sale deeds, Aadhaar/PAN, vehicle RC, insurance certificates, and medical policies in your private encrypted vault.
              </p>
              <button
                onClick={() => setModalType('DOCUMENT')}
                className="mt-2 py-2 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload First Document</span>
              </button>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-stone-200 text-center text-xs text-stone-500">
              No documents found matching "{docSearchQuery || docCategoryFilter}".
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredDocuments.map((doc) => {
                const isPdf =
                  doc.original_filename?.toLowerCase().endsWith('.pdf') ||
                  doc.file_type?.toLowerCase() === 'pdf' ||
                  doc.mime_type === 'application/pdf';

                return (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-2xl bg-white border border-stone-200 flex flex-col gap-2.5 shadow-xs hover:border-emerald-700/40 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-mono text-[10px] font-bold ${
                            isPdf ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {isPdf ? 'PDF' : 'IMG'}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-bold text-stone-900">{doc.title}</h4>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600 font-medium">
                              {doc.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                            <span>{formatFileSize(doc.file_size_bytes, doc.file_size_kb)}</span>
                            <span>·</span>
                            <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                          </div>

                          {(doc.description || doc.notes) && (
                            <p className="text-[11px] text-stone-600 mt-1 line-clamp-2">
                              {doc.description || doc.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Icon Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setViewingDoc(doc)}
                          title="View Document"
                          className="p-1.5 rounded-lg text-stone-500 hover:text-emerald-800 hover:bg-emerald-50 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <a
                          href={storageService.getDocumentDownloadUrl(doc.id)}
                          download={doc.original_filename || `${doc.title}.pdf`}
                          title="Download Document"
                          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>

                        <button
                          onClick={() => setEditingDoc({ ...doc })}
                          title="Edit Document"
                          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeletingDoc(doc)}
                          title="Delete Document"
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Nominee Permission Status Bar */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[10px]">
                      {doc.allow_nominee_emergency_access ? (
                        <div className="flex items-center gap-1 text-emerald-800 font-semibold">
                          <Shield className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Nominee Emergency Access: Permitted</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-stone-500">
                          <Lock className="w-3 h-3 text-stone-400" />
                          <span>Owner Only (Nominee cannot view)</span>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          const updated = !doc.allow_nominee_emergency_access;
                          storageService.updateDocumentMetadata(doc.id, {
                            allow_nominee_emergency_access: updated,
                          });
                        }}
                        className={`text-[10px] font-semibold underline ${
                          doc.allow_nominee_emergency_access
                            ? 'text-rose-700 hover:text-rose-800'
                            : 'text-emerald-800 hover:text-emerald-900'
                        }`}
                      >
                        {doc.allow_nominee_emergency_access ? 'Revoke Nominee' : 'Allow Nominee'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* UPLOAD DOCUMENT MODAL (GOOGLE DRIVE STYLE) */}
      {/* ------------------------------------------------------------- */}
      {modalType === 'DOCUMENT' && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white border border-stone-200 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide">
                  Upload Document to Vault
                </h3>
                <p className="text-[11px] text-stone-500">
                  Files are saved in secure, private persistent storage.
                </p>
              </div>
              <button
                onClick={() => !isUploading && setModalType('NONE')}
                disabled={isUploading}
                className="text-stone-400 hover:text-stone-600 disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Message */}
            {uploadErrorMessage && (
              <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{uploadErrorMessage}</span>
              </div>
            )}

            {/* Success Message */}
            {uploadSuccessMessage && (
              <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>{uploadSuccessMessage}</span>
              </div>
            )}

            <form onSubmit={handleUploadDocumentSubmit} className="space-y-3.5">
              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Selected File <span className="text-rose-600">*</span>
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".pdf,image/jpeg,image/jpg,image/png"
                  className="hidden"
                />

                {!docFile ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-stone-300 hover:border-emerald-700 rounded-2xl p-6 text-center bg-stone-50 hover:bg-emerald-50/30 transition-all flex flex-col items-center justify-center gap-2 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white shadow-xs border border-stone-200 flex items-center justify-center text-stone-600 group-hover:text-emerald-800">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-stone-800">
                      Tap or Browse to Upload Document
                    </span>
                    <span className="text-[10px] text-stone-500">
                      Supported: PDF, JPG, JPEG, PNG (Max 15MB)
                    </span>
                  </button>
                ) : (
                  <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-stone-900 truncate">
                          {docFile.name}
                        </p>
                        <p className="text-[10px] text-stone-500">
                          {formatFileSize(docFile.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDocFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-stone-400 hover:text-rose-600 text-xs font-semibold px-2 py-1"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              {/* Document Name */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Document Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="e.g. Sale Deed for Chennai Property, Term Insurance 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                  required
                />
              </div>

              {/* Document Category */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Document Category <span className="text-rose-600">*</span>
                </label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value as DocumentCategory)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                >
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional Description */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Description / Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  value={docDescription}
                  onChange={(e) => setDocDescription(e.target.value)}
                  placeholder="e.g. Original stored in safe locker key 3; registered under joint name."
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                />
              </div>

              {/* NOMINEE EMERGENCY PERMISSION TOGGLE */}
              <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <label
                      htmlFor="nominee-permission-toggle"
                      className="text-xs font-bold text-stone-900 cursor-pointer flex items-center gap-1.5"
                    >
                      <Shield className="w-3.5 h-3.5 text-emerald-800" />
                      <span>Allow authorized nominee to view this document during an approved emergency.</span>
                    </label>
                    <p className="text-[10px] text-stone-600">
                      Default is OFF. When disabled, this document remains private to you and will never be shown to nominees.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="nominee-permission-toggle"
                    checked={docAllowNomineeAccess}
                    onChange={(e) => setDocAllowNomineeAccess(e.target.checked)}
                    className="w-5 h-5 rounded text-emerald-800 focus:ring-emerald-700 border-stone-300 cursor-pointer mt-0.5 shrink-0"
                  />
                </div>
              </div>

              {/* Upload Progress Bar */}
              {isUploading && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[11px] text-stone-600 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-800" />
                      Saving to backend database & storage...
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-800 transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-3.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-semibold text-xs mt-2 shadow-xs flex items-center justify-center gap-2 transition-all"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Document...</span>
                  </>
                ) : (
                  <span>Save Document</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW DOCUMENT MODAL */}
      {/* ------------------------------------------------------------- */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="text-xs font-bold text-stone-900 truncate max-w-xs">
                  {viewingDoc.title}
                </h3>
                <span className="text-[10px] text-stone-500">
                  {viewingDoc.category} · {formatFileSize(viewingDoc.file_size_bytes, viewingDoc.file_size_kb)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={storageService.getDocumentDownloadUrl(viewingDoc.id)}
                  download={viewingDoc.original_filename || `${viewingDoc.title}.pdf`}
                  className="py-1 px-2.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-semibold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewer Body */}
            <div className="flex-1 overflow-auto p-4 bg-stone-100 flex items-center justify-center min-h-[300px]">
              {viewingDoc.mime_type?.startsWith('image/') ||
              viewingDoc.original_filename?.match(/\.(jpg|jpeg|png)$/i) ? (
                <img
                  src={storageService.getDocumentViewUrl(viewingDoc.id)}
                  alt={viewingDoc.title}
                  className="max-h-[65vh] max-w-full rounded-xl object-contain shadow-md"
                />
              ) : (
                <iframe
                  src={storageService.getDocumentViewUrl(viewingDoc.id)}
                  title={viewingDoc.title}
                  className="w-full h-[65vh] rounded-xl border border-stone-300 bg-white"
                />
              )}
            </div>

            {/* Viewer Footer */}
            <div className="p-3 bg-white border-t border-stone-200 text-xs text-stone-600 flex items-center justify-between">
              <span className="text-[10px] text-stone-400">
                Uploaded {new Date(viewingDoc.created_at).toLocaleDateString()}
              </span>
              <span className="text-[10px] font-semibold">
                Nominee Access: {viewingDoc.allow_nominee_emergency_access ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* EDIT DOCUMENT MODAL */}
      {/* ------------------------------------------------------------- */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-stone-200 rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide">
                Edit Document Details
              </h3>
              <button onClick={() => { setEditingDoc(null); setDocActionError(''); }} className="text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {docActionError && (
              <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-2">
                <span>{docActionError}</span>
                <button
                  type="button"
                  onClick={() => setDocActionError('')}
                  className="text-rose-500 hover:text-rose-700 p-0.5 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleEditDocumentSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Document Name</label>
                <input
                  type="text"
                  value={editingDoc.title}
                  onChange={(e) => setEditingDoc({ ...editingDoc, title: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Category</label>
                <select
                  value={editingDoc.category}
                  onChange={(e) => setEditingDoc({ ...editingDoc, category: e.target.value as any })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                >
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Description / Instructions
                </label>
                <textarea
                  rows={2}
                  value={editingDoc.description || ''}
                  onChange={(e) => setEditingDoc({ ...editingDoc, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-stone-900 block">
                    Allow authorized nominee to view this document during an approved emergency.
                  </span>
                  <span className="text-[10px] text-stone-500 block">
                    Strict privacy enforcement by LIFORA backend.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={editingDoc.allow_nominee_emergency_access}
                  onChange={(e) =>
                    setEditingDoc({
                      ...editingDoc,
                      allow_nominee_emergency_access: e.target.checked,
                    })
                  }
                  className="w-5 h-5 rounded text-emerald-800 focus:ring-emerald-700 border-stone-300 cursor-pointer mt-0.5"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ------------------------------------------------------------- */}
      {deletingDoc && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white border border-stone-200 rounded-3xl p-5 shadow-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-stone-900">Delete Document?</h3>
            {docActionError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2">
                <span>{docActionError}</span>
                <button
                  type="button"
                  onClick={() => setDocActionError('')}
                  className="text-rose-500 hover:text-rose-700 p-0.5 shrink-0"
                  title="Clear error"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <p className="text-xs text-stone-600">
              Are you sure you want to permanently delete{' '}
              <strong className="text-stone-900">"{deletingDoc.title}"</strong> from your secure vault? This action cannot be undone.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingDoc(null);
                  setDocActionError('');
                }}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDocument}
                className="flex-1 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-xs"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ADD PROPERTY / VEHICLE / VALUABLE MODALS */}
      {/* ------------------------------------------------------------- */}
      {modalType !== 'NONE' && modalType !== 'DOCUMENT' && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white border border-stone-200 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide">
                {modalType === 'PROPERTY' && 'Add Property / Land'}
                {modalType === 'VEHICLE' && 'Add Vehicle'}
                {modalType === 'VALUABLE' && 'Add Valuable Asset'}
              </h3>
              <button onClick={() => setModalType('NONE')} className="text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalType === 'PROPERTY' && (
              <form onSubmit={handleSaveProperty} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Category</label>
                  <select
                    value={propCategory}
                    onChange={(e) => setPropCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs"
                  >
                    <option value="HOUSE">House / Residential</option>
                    <option value="LAND">Land / Plot</option>
                    <option value="PROPERTY">Commercial / Agricultural</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Name / Title</label>
                  <input
                    type="text"
                    value={propName}
                    onChange={(e) => setPropName(e.target.value)}
                    placeholder="e.g. Ancestral House, OMR Apartment"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={propLocation}
                    onChange={(e) => setPropLocation(e.target.value)}
                    placeholder="e.g. Anna Nagar West, Chennai"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Estimated Value (₹)</label>
                  <input
                    type="number"
                    value={propValue}
                    onChange={(e) => setPropValue(e.target.value)}
                    placeholder="e.g. 8500000"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-mono shadow-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs mt-3 shadow-xs"
                >
                  Save Property
                </button>
              </form>
            )}

            {modalType === 'VEHICLE' && (
              <form onSubmit={handleSaveVehicle} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Type</label>
                  <select
                    value={vehType}
                    onChange={(e) => setVehType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs"
                  >
                    <option value="CAR">Car</option>
                    <option value="TWO_WHEELER">Two-Wheeler</option>
                    <option value="COMMERCIAL">Commercial</option>
                    <option value="ELECTRIC">Electric</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Brand</label>
                    <input
                      type="text"
                      value={vehBrand}
                      onChange={(e) => setVehBrand(e.target.value)}
                      placeholder="e.g. Hyundai"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Model</label>
                    <input
                      type="text"
                      value={vehModel}
                      onChange={(e) => setVehModel(e.target.value)}
                      placeholder="e.g. Creta"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Registration Number</label>
                  <input
                    type="text"
                    value={vehRegNo}
                    onChange={(e) => setVehRegNo(e.target.value)}
                    placeholder="e.g. TN 09 BK 4590"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-mono shadow-xs"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs mt-3 shadow-xs"
                >
                  Save Vehicle
                </button>
              </form>
            )}

            {modalType === 'VALUABLE' && (
              <form onSubmit={handleSaveValuable} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Category</label>
                  <select
                    value={valCategory}
                    onChange={(e) => setValCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs"
                  >
                    <option value="GOLD">Gold Jewelry</option>
                    <option value="DIAMONDS">Diamonds</option>
                    <option value="SILVER">Silver</option>
                    <option value="HEIRLOOM">Heirloom</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={valName}
                    onChange={(e) => setValName(e.target.value)}
                    placeholder="e.g. Wedding Gold Ornaments"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Weight (Grams)</label>
                    <input
                      type="number"
                      value={valWeight}
                      onChange={(e) => setValWeight(e.target.value)}
                      placeholder="e.g. 120"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-mono shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Estimated Value (₹)</label>
                    <input
                      type="number"
                      value={valEstimated}
                      onChange={(e) => setValEstimated(e.target.value)}
                      placeholder="e.g. 720000"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-mono shadow-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Locker / Storage Location</label>
                  <input
                    type="text"
                    value={valLocation}
                    onChange={(e) => setValLocation(e.target.value)}
                    placeholder="e.g. SBI Safe Locker #214"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs mt-3 shadow-xs"
                >
                  Save Asset
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
