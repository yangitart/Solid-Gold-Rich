import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { C, SANS, createThemeStyles } from '@/shared/theme/luxury';
import DateSelect from '@/shared/ui/DateSelect';
import { FormField, SearchableSelect, type SelectOption } from '@/shared/ui/FormKit';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type ProductFormDraft = {
  key: string;
  name: string;
  type: 'product' | 'service';
  unit: string;
  unitAbbreviation: string;
  categoryId: string;
  purchasePrice: string;
  salePrice: string;
  additionalSalePrices: string[];
  picture?: string;
  icon: IconName;
  stock: string;
  reservedQuantity: string;
  stockMinimum: string;
  expirationDate: string;
  additionalInfo: string;
};

export type ProductFormTextField = 'key' | 'name' | 'unit' | 'unitAbbreviation' | 'purchasePrice' | 'salePrice' | 'stock' | 'reservedQuantity' | 'stockMinimum' | 'additionalInfo';

export const PRODUCT_ICON_OPTIONS: IconName[] = [
  'cube-outline', 'restaurant-outline', 'cafe-outline', 'cart-outline', 'shirt-outline', 'home-outline',
  'construct-outline', 'phone-portrait-outline', 'laptop-outline', 'book-outline', 'gift-outline', 'pricetag-outline',
];

type ProductFormProps = {
  draft: ProductFormDraft;
  errors: Record<string, string>;
  editing: boolean;
  service: boolean;
  customUnitOpen: boolean;
  moreOpen: boolean;
  categoryOptions: SelectOption[];
  unitOptions: SelectOption[];
  purchaseAccountOptions: SelectOption[];
  purchaseAccountId: string;
  onChangeText: (field: ProductFormTextField, value: string, clearErrors?: string[]) => void;
  onAdditionalPriceChange: (index: number, value: string) => void;
  onRemoveAdditionalPrice: (index: number) => void;
  onAddAdditionalPrice: () => void;
  onUnitChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onAddCategory: (name: string) => void;
  onPurchaseAccountChange: (value: string) => void;
  onManageCategories: () => void;
  onIconChange: (icon: IconName) => void;
  onToggleMore: () => void;
  onChoosePicture: () => void;
  onRemovePicture: () => void;
  onExpirationChange: (value: string) => void;
  onClearExpiration: () => void;
};

function Section({ icon, title, children, collapsible = false, open = true, onPress, showHeader = true }: { icon: IconName; title: string; children?: React.ReactNode; collapsible?: boolean; open?: boolean; onPress?: () => void; showHeader?: boolean }) {
  const header = <View style={styles.sectionHeader}>
    <View style={styles.sectionIcon}><Ionicons name={icon} size={17} color={C.gold} /></View>
    <Text style={styles.sectionTitle}>{title}</Text>
    {collapsible ? <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={17} color={C.gold} /> : null}
  </View>;
  return <View style={styles.section}>{showHeader ? (collapsible ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }}>{header}</Pressable> : header) : null}{open ? <View style={styles.sectionBody}>{children}</View> : null}</View>;
}

export default function StoreProductForm({
  draft,
  errors,
  editing,
  service,
  customUnitOpen,
  moreOpen,
  categoryOptions,
  unitOptions,
  purchaseAccountOptions,
  purchaseAccountId,
  onChangeText,
  onAdditionalPriceChange,
  onRemoveAdditionalPrice,
  onAddAdditionalPrice,
  onUnitChange,
  onCategoryChange,
  onAddCategory,
  onPurchaseAccountChange,
  onManageCategories,
  onIconChange,
  onToggleMore,
  onChoosePicture,
  onRemovePicture,
  onExpirationChange,
  onClearExpiration,
}: ProductFormProps) {
  const { t } = useTranslation();
  const initialPurchaseTotal = Number(draft.stock || '0') * Number(draft.purchasePrice || '0');
  const showPurchaseSource = !editing && !service && Number.isFinite(initialPurchaseTotal) && initialPurchaseTotal > 0;
  return <View style={styles.form}>
    <Section icon="barcode-outline" title={t('finance.store.sectionIdentity')} showHeader={false}>
      <FormField label={service ? t('finance.store.service') : t('finance.store.productName')} value={draft.name} onChangeText={(value) => onChangeText('name', value, ['name'])} required error={errors.name} />
      {!service ? <FormField label={t('finance.store.productKey')} value={draft.key} onChangeText={(value) => onChangeText('key', value, ['key'])} required error={errors.key} /> : null}
      <SearchableSelect label={t('finance.store.category')} value={draft.categoryId} options={categoryOptions} onChange={onCategoryChange} placeholder={t('finance.store.generalCategory')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} emptyAction={{ label: t('finance.addCategory'), onPress: onAddCategory }} required error={errors.category} />
      <Pressable style={styles.manageCategories} onPress={onManageCategories} accessibilityRole="button"><View style={styles.manageCategoriesIcon}><Ionicons name="settings-outline" size={17} color={C.gold} /></View><Text style={styles.manageCategoriesText}>{t('finance.store.manageCategories')}</Text><Ionicons name="chevron-forward" size={17} color={C.textSubtle} /></Pressable>
      <SearchableSelect label={t('finance.store.unit')} value={customUnitOpen ? '__custom__' : draft.unit} options={unitOptions} onChange={onUnitChange} placeholder={t('finance.store.unit')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} required error={errors.unit} />
      {customUnitOpen ? <View style={styles.customUnitFields}>
        <FormField label={t('finance.storeUnits.fullName')} value={draft.unit} onChangeText={(value) => onChangeText('unit', value, ['unit', 'unitName'])} placeholder={t('finance.storeUnits.fullNamePlaceholder')} required error={errors.unit || errors.unitName} />
        <FormField label={t('finance.storeUnits.abbreviation')} value={draft.unitAbbreviation} onChangeText={(value) => onChangeText('unitAbbreviation', value, ['unitAbbreviation'])} placeholder={t('finance.storeUnits.abbreviationPlaceholder')} required maxLength={4} error={errors.unitAbbreviation} />
      </View> : null}
    </Section>

    <Section icon="pricetag-outline" title={t('finance.store.sectionPrices')}>
      <View style={styles.twoColumns}>
        <View style={styles.column}><FormField label={t('finance.store.salePrice')} value={draft.salePrice} onChangeText={(value) => onChangeText('salePrice', value, ['salePrice', 'numbers'])} numeric required error={errors.salePrice} /></View>
        <View style={styles.column}><FormField label={t('finance.store.purchasePrice')} value={draft.purchasePrice} onChangeText={(value) => onChangeText('purchasePrice', value, ['numbers', 'purchase'])} numeric error={errors.numbers} /></View>
      </View>
    </Section>

    {!service ? <Section icon="cube-outline" title={t('finance.store.sectionInventory')}>
      <View style={styles.twoColumns}>
        <View style={styles.column}>{editing ? <FormField label={t('finance.store.quantityReserve')} value={draft.reservedQuantity} onChangeText={(value) => onChangeText('reservedQuantity', value, ['reserve', 'numbers'])} numeric error={errors.reserve || errors.numbers} /> : <FormField label={t('finance.store.quantity')} value={draft.stock} onChangeText={(value) => onChangeText('stock', value, ['numbers', 'purchase'])} numeric error={errors.numbers} />}</View>
        <View style={styles.column}><FormField label={t('finance.store.stockMinimum')} value={draft.stockMinimum} onChangeText={(value) => onChangeText('stockMinimum', value, ['numbers'])} numeric error={errors.numbers} /></View>
      </View>
      {showPurchaseSource ? <SearchableSelect label={t('finance.storePurchase.purchaseFrom')} value={purchaseAccountId} options={purchaseAccountOptions} onChange={onPurchaseAccountChange} placeholder={t('finance.storePurchase.none')} searchPlaceholder={t('finance.search')} closeLabel={t('finance.close')} emptyLabel={t('finance.modules.noResults')} error={errors.purchase} /> : null}
    </Section> : null}

    <Section icon="layers-outline" title={t('finance.store.moreDetails')} collapsible open={moreOpen} onPress={onToggleMore}>
      <Pressable style={styles.picturePicker} onPress={onChoosePicture}><View style={styles.pictureBox}>{draft.picture ? <Image source={{ uri: draft.picture }} style={styles.pictureImage} /> : <Ionicons name="image-outline" size={22} color={C.gold} />}</View><View style={styles.pictureCopy}><Text style={styles.rowTitle}>{t('finance.store.picture')}</Text><Text style={styles.rowMeta} numberOfLines={2}>{t('finance.store.picturePickerCopy')}</Text></View><Ionicons name="chevron-forward" size={17} color={C.textSubtle} /></Pressable>
      {draft.picture ? <Pressable style={styles.inlineAction} onPress={onRemovePicture}><Text style={styles.dangerLink}>{t('finance.store.removePicture')}</Text></Pressable> : null}
      {!draft.picture ? <View style={styles.iconPicker}><View style={styles.iconHeader}><Text style={styles.subLabel}>{t('finance.chooseIcon')}</Text><View style={styles.selectedIcon}><Ionicons name={draft.icon} size={18} color={C.goldLight} /></View></View><View style={styles.iconChoices} accessibilityLabel={t('finance.chooseIcon')}>{PRODUCT_ICON_OPTIONS.map((icon) => { const selected = draft.icon === icon; return <Pressable key={icon} style={[styles.iconChoice, selected && styles.iconChoiceActive]} onPress={() => onIconChange(icon)} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={t('finance.chooseIcon')}><Ionicons name={icon} size={20} color={selected ? C.void : C.gold} />{selected ? <View style={styles.iconSelectedMark}><Ionicons name="checkmark" size={10} color={C.void} /></View> : null}</Pressable>; })}</View></View> : null}
      {draft.additionalSalePrices.map((price, index) => <View key={index} style={styles.additionalPriceRow}><View style={styles.additionalPriceField}><FormField label={`${t('finance.store.additionalSalePrice')} ${index + 1}`} value={price} onChangeText={(value) => onAdditionalPriceChange(index, value)} numeric error={errors.numbers} /></View><Pressable style={styles.removeButton} onPress={() => onRemoveAdditionalPrice(index)} accessibilityLabel={t('finance.deleteAction')}><Ionicons name="trash-outline" size={17} color={C.red} /></Pressable></View>)}
      <Pressable style={styles.inlineAction} onPress={onAddAdditionalPrice}><Ionicons name="add" size={17} color={C.gold} /><Text style={styles.link}>{t('finance.store.addSalePrice')}</Text></Pressable>
      {!service ? <><DateSelect label={t('finance.store.expiration')} value={draft.expirationDate} emptyLabel={t('finance.store.noExpiration')} onChange={onExpirationChange} /><Pressable style={styles.inlineAction} onPress={onClearExpiration}><Text style={styles.link}>{t('finance.store.clearExpiration')}</Text></Pressable></> : null}
      <FormField label={t('finance.store.additionalInfo')} value={draft.additionalInfo} onChangeText={(value) => onChangeText('additionalInfo', value, ['picture'])} multiline error={errors.picture} />
    </Section>
  </View>;
}

const styles = createThemeStyles((C) => StyleSheet.create({
  form: { gap: 9 },
  section: { borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.022)', overflow: 'hidden' }, sectionHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12 }, sectionIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(233,200,119,0.1)', alignItems: 'center', justifyContent: 'center' }, sectionTitle: { flex: 1, color: C.goldLight, fontFamily: SANS, fontSize: 12, fontWeight: '700', letterSpacing: 0.35 }, sectionBody: { paddingHorizontal: 12, paddingBottom: 13 },
  customUnitFields: { gap: 2 },
  manageCategories: { minHeight: 46, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.2)', backgroundColor: 'rgba(233,200,119,0.055)', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 9, marginTop: 7 },
  manageCategoriesIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(233,200,119,0.11)', alignItems: 'center', justifyContent: 'center' },
  manageCategoriesText: { flex: 1, color: C.goldLight, fontFamily: SANS, fontSize: 10.5, fontWeight: '700' },
  iconPicker: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.16)', backgroundColor: 'rgba(233,200,119,0.035)', padding: 10, marginTop: 11 },
  subLabel: { flex: 1, color: 'rgba(233,200,119,0.72)', fontFamily: SANS, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.35 },
  iconHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  selectedIcon: { width: 34, height: 34, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(233,200,119,0.26)', backgroundColor: 'rgba(233,200,119,0.12)', alignItems: 'center', justifyContent: 'center' },
  iconChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChoice: { width: 46, height: 46, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.035)', alignItems: 'center', justifyContent: 'center' },
  iconChoiceActive: { backgroundColor: C.gold, borderColor: C.gold },
  iconSelectedMark: { position: 'absolute', top: 3, right: 3, width: 14, height: 14, borderRadius: 7, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  twoColumns: { flexDirection: 'row', gap: 9 }, column: { flex: 1, minWidth: 0 }, additionalPriceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 }, additionalPriceField: { flex: 1, minWidth: 0 }, removeButton: { width: 40, height: 43, alignItems: 'center', justifyContent: 'center' },
  inlineAction: { minHeight: 35, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 2 }, link: { color: C.gold, fontFamily: SANS, fontSize: 10.5, fontWeight: '700' }, dangerLink: { color: C.red, fontFamily: SANS, fontSize: 10.5, fontWeight: '700' },
  picturePicker: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, pictureBox: { width: 46, height: 46, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, pictureImage: { width: '100%', height: '100%' }, pictureCopy: { flex: 1, minWidth: 0 }, rowTitle: { color: C.goldLight, fontFamily: SANS, fontSize: 12 }, rowMeta: { color: 'rgba(255,244,208,0.46)', fontFamily: SANS, fontSize: 10, lineHeight: 15, marginTop: 3 },
}));
