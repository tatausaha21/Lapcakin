import { useState } from 'react'

const initialForm = {
  namaUnit: '',
  kodeUnit: '',
  jenisUnit: 'Seksi',
  indukOrganisasi: '',
  kepalaUnit: '',
  nipKepalaUnit: '',
  email: '',
  telepon: '',
  alamat: '',
  status: 'Aktif',
  catatan: '',
}

const indukOptions = [
  'Biro Ortala Kemenag RI',
  'Kantor Wilayah Provinsi',
  'Kantor Kementerian Agama Kabupaten/Kota',
  'Satuan Kerja Langsung',
]

function UnitKerjaForm() {
  const [form, setForm] = useState(initialForm)
  const [submitted, setSubmitted] = useState(false)

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setSubmitted(false)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
  }

  const handleReset = () => {
    setForm(initialForm)
    setSubmitted(false)
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col gap-space-2xs mb-space-lg">
        <div className="flex items-center gap-space-xs text-secondary font-label-md">
          <span className="hover:text-primary transition-colors cursor-pointer">SICAKIN Kemenag</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="hover:text-primary transition-colors cursor-pointer">Admin Organisasi</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Master Unit Kerja</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-space-sm">
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
            Tambah Unit Kerja
          </h1>
          <span className="inline-flex w-fit items-center gap-space-2xs px-space-xs py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm uppercase font-bold tracking-wider">
            <span className="material-symbols-outlined text-[14px]">add_circle</span>
            Form Registrasi
          </span>
        </div>
        <p className="font-body-md text-body-md text-secondary max-w-3xl">
          Lengkapi informasi unit kerja baru untuk mendaftarkan seksi, subbagian, atau satuan kerja ke dalam sistem SICAKIN.
        </p>
      </div>

      {submitted && (
        <div className="mb-space-lg flex items-start gap-space-sm rounded-xl border border-primary-fixed bg-primary-fixed/20 p-space-md text-primary">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <div>
            <h3 className="font-title-sm text-title-sm font-bold">Data unit kerja berhasil disimpan</h3>
            <p className="font-body-sm text-body-sm text-primary/80">Unit kerja {form.namaUnit || 'baru'} telah ditambahkan ke master data.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-surface-container px-space-md py-space-sm bg-surface-container-low/50">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Informasi Unit Kerja</h2>
            <p className="font-body-sm text-body-sm text-secondary">Kolom bertanda <span className="text-error font-bold">*</span> wajib diisi</p>
          </div>
          <span className="inline-flex items-center gap-space-2xs px-space-xs py-0.5 rounded-full bg-surface-container text-secondary font-label-sm font-bold">
            <span className="material-symbols-outlined text-[15px]">description</span>
            Formulir Baru
          </span>
        </div>

        <div className="p-space-md space-y-space-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div className="flex flex-col gap-space-2xs">
              <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="namaUnit">
                Nama Unit Kerja <span className="text-error">*</span>
              </label>
              <input
                id="namaUnit"
                type="text"
                value={form.namaUnit}
                onChange={(event) => updateField('namaUnit', event.target.value)}
                className="h-[44px] rounded-lg border border-outline-variant bg-surface px-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
                placeholder="Contoh: Seksi Pendidikan Madrasah"
              />
            </div>

            <div className="flex flex-col gap-space-2xs">
              <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="kodeUnit">
                Kode Unit Kerja <span className="text-error">*</span>
              </label>
              <input
                id="kodeUnit"
                type="text"
                value={form.kodeUnit}
                onChange={(event) => updateField('kodeUnit', event.target.value)}
                className="h-[44px] rounded-lg border border-outline-variant bg-surface px-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
                placeholder="Contoh: SEKS-PENDIS-01"
              />
              <span className="font-label-sm text-label-sm text-secondary">Gunakan format kode unik untuk setiap unit kerja.</span>
            </div>

            <div className="flex flex-col gap-space-2xs">
              <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="jenisUnit">
                Jenis Unit <span className="text-error">*</span>
              </label>
              <select
                id="jenisUnit"
                value={form.jenisUnit}
                onChange={(event) => updateField('jenisUnit', event.target.value)}
                className="h-[44px] rounded-lg border border-outline-variant bg-surface px-space-sm font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
              >
                <option>Seksi</option>
                <option>Subbagian</option>
                <option>Bagian</option>
                <option>Bidang</option>
                <option>Satuan Kerja</option>
              </select>
            </div>

            <div className="flex flex-col gap-space-2xs">
              <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="indukOrganisasi">
                Induk Organisasi <span className="text-error">*</span>
              </label>
              <select
                id="indukOrganisasi"
                value={form.indukOrganisasi}
                onChange={(event) => updateField('indukOrganisasi', event.target.value)}
                className="h-[44px] rounded-lg border border-outline-variant bg-surface px-space-sm font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
              >
                <option value="">Pilih induk organisasi</option>
                {indukOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-space-2xs">
              <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="kepalaUnit">
                Kepala Unit / Penanggung Jawab <span className="text-error">*</span>
              </label>
              <input
                id="kepalaUnit"
                type="text"
                value={form.kepalaUnit}
                onChange={(event) => updateField('kepalaUnit', event.target.value)}
                className="h-[44px] rounded-lg border border-outline-variant bg-surface px-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
                placeholder="Nama lengkap beserta gelar"
              />
            </div>

            <div className="flex flex-col gap-space-2xs">
              <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="nipKepalaUnit">
                NIP Kepala Unit
              </label>
              <input
                id="nipKepalaUnit"
                type="text"
                value={form.nipKepalaUnit}
                onChange={(event) => updateField('nipKepalaUnit', event.target.value)}
                className="h-[44px] rounded-lg border border-outline-variant bg-surface px-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
                placeholder="NIP 18 digit"
              />
            </div>

            <div className="flex flex-col gap-space-2xs">
              <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="email">
                Email Unit
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                className="h-[44px] rounded-lg border border-outline-variant bg-surface px-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
                placeholder="unitkerja@kemenag.go.id"
              />
            </div>

            <div className="flex flex-col gap-space-2xs">
              <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="telepon">
                Nomor Telepon
              </label>
              <input
                id="telepon"
                type="tel"
                value={form.telepon}
                onChange={(event) => updateField('telepon', event.target.value)}
                className="h-[44px] rounded-lg border border-outline-variant bg-surface px-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
                placeholder="021-1234567"
              />
            </div>

            <div className="md:col-span-2 flex flex-col gap-space-2xs">
              <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="alamat">
                Alamat Unit Kerja
              </label>
              <textarea
                id="alamat"
                value={form.alamat}
                onChange={(event) => updateField('alamat', event.target.value)}
                rows="3"
                className="min-h-[88px] rounded-lg border border-outline-variant bg-surface px-space-sm py-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed resize-y"
                placeholder="Alamat lengkap kantor unit kerja"
              />
            </div>

            <div className="flex flex-col gap-space-2xs">
              <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="status">
                Status Unit
              </label>
              <select
                id="status"
                value={form.status}
                onChange={(event) => updateField('status', event.target.value)}
                className="h-[44px] rounded-lg border border-outline-variant bg-surface px-space-sm font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
              >
                <option>Aktif</option>
                <option>Nonaktif</option>
                <option>Dalam Verifikasi</option>
              </select>
            </div>

            <div className="md:col-span-2 flex flex-col gap-space-2xs">
              <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="catatan">
                Catatan Tambahan
              </label>
              <textarea
                id="catatan"
                value={form.catatan}
                onChange={(event) => updateField('catatan', event.target.value)}
                rows="3"
                className="min-h-[88px] rounded-lg border border-outline-variant bg-surface px-space-sm py-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed resize-y"
                placeholder="Informasi tambahan mengenai unit kerja"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-space-sm border-t border-surface-container bg-surface-container-low/40 px-space-md py-space-md">
          <button type="button" onClick={handleReset} className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-outline-variant bg-surface-container-lowest px-space-md font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Reset Form
          </button>
          <button type="submit" className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors">
            <span className="material-symbols-outlined text-[18px]">save</span>
            Simpan Unit Kerja
          </button>
        </div>
      </form>
    </div>
  )
}

export default UnitKerjaForm