import 'package:material_ui/material_ui.dart';

import '../core/theme.dart';

/// 4-digit PIN entry with an on-screen keypad (no text field, so it also works
/// above the navigator where no Overlay exists).
class PinPad extends StatefulWidget {
  const PinPad({
    super.key,
    required this.onCompleted,
    this.length = 4,
    this.error,
    this.enabled = true,
  });

  final ValueChanged<String> onCompleted;
  final int length;
  final String? error;
  final bool enabled;

  @override
  State<PinPad> createState() => PinPadState();
}

class PinPadState extends State<PinPad> {
  String _value = '';

  void clear() => setState(() => _value = '');

  void _tap(String digit) {
    if (!widget.enabled || _value.length >= widget.length) return;
    setState(() => _value += digit);
    if (_value.length == widget.length) {
      final pin = _value;
      Future<void>.delayed(const Duration(milliseconds: 120), () {
        if (!mounted) return;
        setState(() => _value = '');
        widget.onCompleted(pin);
      });
    }
  }

  void _back() {
    if (_value.isEmpty) return;
    setState(() => _value = _value.substring(0, _value.length - 1));
  }

  Widget _key(
    String label, {
    VoidCallback? onTap,
    IconData? icon,
    String? semantics,
  }) => Semantics(
    button: true,
    label: semantics ?? label,
    child: SizedBox(
      width: 72,
      height: 60,
      child: Material(
        color: onTap == null ? Colors.transparent : AppColors.surfaceTint,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Center(
            child: icon != null
                ? Icon(icon, color: AppColors.navy)
                : Text(
                    label,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                      color: AppColors.navy,
                    ),
                  ),
          ),
        ),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
    ];
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          label: '${_value.length} of ${widget.length}',
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < widget.length; i++)
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 8),
                  width: 16,
                  height: 16,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: i < _value.length ? AppColors.navy : null,
                    border: Border.all(color: AppColors.navy, width: 2),
                  ),
                ),
            ],
          ),
        ),
        SizedBox(
          height: 28,
          child: widget.error == null
              ? null
              : Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    widget.error!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.danger,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
        ),
        for (final r in rows)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final d in r)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: _key(d, onTap: () => _tap(d)),
                  ),
              ],
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: _key(''),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: _key('0', onTap: () => _tap('0')),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: _key(
                  '',
                  icon: Icons.backspace_outlined,
                  semantics: 'Delete',
                  onTap: _back,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
