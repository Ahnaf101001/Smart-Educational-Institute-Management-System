import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../l10n/l10n_ext.dart';
import 'live_sync.dart';
import 'theme.dart';

/// All animation timings in one place. Only transform / opacity are animated,
/// and every effect is switched off when the phone asks for reduced motion
/// (Settings → Accessibility → Remove animations).
class Motion {
  Motion._();

  static const Duration fast = Duration(milliseconds: 180);
  static const Duration base = Duration(milliseconds: 220);
  static const Duration slow = Duration(milliseconds: 250);
  static const Duration stagger = Duration(milliseconds: 40);
  static const Duration pulse = Duration(milliseconds: 900);
  static const Duration shimmer = Duration(milliseconds: 1300);

  /// Staggered entrances stop growing after this many items so long lists
  /// never wait for their content.
  static const int maxStagger = 8;
  static const double pressScale = 0.97;
  static const Curve curve = Curves.easeOutCubic;

  static bool reduced(BuildContext context) =>
      MediaQuery.maybeDisableAnimationsOf(context) ?? false;
}

/// Fade + small upward slide on first build; [index] staggers siblings by
/// [Motion.stagger]. Runs on the animation ticker (no timers).
class Reveal extends StatefulWidget {
  const Reveal({super.key, this.index = 0, required this.child});

  final int index;
  final Widget child;

  @override
  State<Reveal> createState() => _RevealState();
}

class _RevealState extends State<Reveal> with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _t;

  @override
  void initState() {
    super.initState();
    final delay = Motion.stagger * widget.index.clamp(0, Motion.maxStagger);
    final total = delay + Motion.base;
    _c = AnimationController(vsync: this, duration: total);
    final start = delay.inMicroseconds / total.inMicroseconds;
    _t = CurvedAnimation(
      parent: _c,
      curve: Interval(start, 1, curve: Motion.curve),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context)) {
      _c.value = 1;
    } else if (!_c.isAnimating && _c.value == 0) {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
    opacity: _t,
    child: SlideTransition(
      position: Tween(
        begin: const Offset(0, 0.06),
        end: Offset.zero,
      ).animate(_t),
      child: widget.child,
    ),
  );
}

/// Wraps each widget in a [Reveal] with increasing stagger.
List<Widget> staggered(
  Iterable<Widget> children, {
  int start = 0,
  bool press = false,
}) {
  var i = start;
  return [
    for (final w in children)
      Reveal(
        index: i++,
        child: press ? Pressable(child: w) : w,
      ),
  ];
}

/// Tactile press feedback: the child shrinks to [Motion.pressScale] while a
/// finger is down. It only listens to pointers, so the child's own InkWell /
/// onTap keeps working unchanged.
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child});

  final Widget child;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) => Listener(
    onPointerDown: (_) => _set(true),
    onPointerUp: (_) => _set(false),
    onPointerCancel: (_) => _set(false),
    child: AnimatedScale(
      scale: _down && !Motion.reduced(context) ? Motion.pressScale : 1,
      duration: Motion.fast,
      curve: Motion.curve,
      child: widget.child,
    ),
  );
}

/// Progress bar whose value animates to its target (0–1).
class AnimatedProgressBar extends StatelessWidget {
  const AnimatedProgressBar({
    super.key,
    required this.value,
    this.minHeight = 8,
    this.color,
    this.backgroundColor,
  });

  final double value;
  final double minHeight;
  final Color? color;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 0, end: value.clamp(0, 1).toDouble()),
    duration: Motion.reduced(context) ? Duration.zero : Motion.slow * 2,
    curve: Motion.curve,
    builder: (context, v, _) => LinearProgressIndicator(
      value: v,
      minHeight: minHeight,
      color: color,
      backgroundColor: backgroundColor,
    ),
  );
}

/// Light sweep across grey placeholder blocks while data loads.
class Shimmer extends StatefulWidget {
  const Shimmer({super.key, required this.child});

  final Widget child;

  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: Motion.shimmer,
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context)) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _c,
    child: widget.child,
    builder: (context, child) => ShaderMask(
      blendMode: BlendMode.srcATop,
      shaderCallback: (rect) {
        final dx = rect.width * (_c.value * 3 - 1);
        return LinearGradient(
          colors: const [
            Color(0xFFE6ECF3),
            Color(0xFFF7F9FC),
            Color(0xFFE6ECF3),
          ],
          stops: const [0.35, 0.5, 0.65],
          transform: _Slide(dx),
        ).createShader(rect);
      },
      child: child,
    ),
  );
}

class _Slide extends GradientTransform {
  const _Slide(this.dx);
  final double dx;

  @override
  Matrix4 transform(Rect bounds, {TextDirection? textDirection}) =>
      Matrix4.translationValues(dx - bounds.width, 0, 0);
}

/// Placeholder that mirrors a typical screen (stat tiles + list rows),
/// shown instead of a spinner during the first API fetch.
class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.rows = 5});

  final int rows;

  @override
  Widget build(BuildContext context) {
    Widget block(double h, {double? w, double r = 12}) => Container(
      height: h,
      width: w,
      decoration: BoxDecoration(
        color: const Color(0xFFE6ECF3),
        borderRadius: BorderRadius.circular(r),
      ),
    );
    return Semantics(
      label: 'Loading',
      child: Shimmer(
        child: ListView(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                Expanded(child: block(86)),
                const SizedBox(width: 10),
                Expanded(child: block(86)),
              ],
            ),
            const SizedBox(height: 16),
            for (var i = 0; i < rows; i++) ...[
              Row(
                children: [
                  block(40, w: 40, r: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        block(12, w: 180, r: 6),
                        const SizedBox(height: 8),
                        block(10, r: 6),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
            ],
          ],
        ),
      ),
    );
  }
}

/// Fade + slight slide for pushed screens (used by the app theme).
class FadeSlidePageTransitionsBuilder extends PageTransitionsBuilder {
  const FadeSlidePageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (Motion.reduced(context)) return child;
    final t = CurvedAnimation(parent: animation, curve: Motion.curve);
    final out = CurvedAnimation(
      parent: secondaryAnimation,
      curve: Motion.curve,
    );
    return FadeTransition(
      opacity: t,
      child: SlideTransition(
        position: Tween(
          begin: const Offset(0.06, 0),
          end: Offset.zero,
        ).animate(t),
        child: SlideTransition(
          position: Tween(
            begin: Offset.zero,
            end: const Offset(-0.03, 0),
          ).animate(out),
          child: child,
        ),
      ),
    );
  }
}

/// Soft highlight that fades over its child each time [trigger] changes –
/// used to show that data just refreshed from the school.
class SyncPulse extends StatefulWidget {
  const SyncPulse({super.key, required this.trigger, required this.child});

  final Object? trigger;
  final Widget child;

  @override
  State<SyncPulse> createState() => _SyncPulseState();
}

class _SyncPulseState extends State<SyncPulse>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: Motion.pulse,
  );

  @override
  void didUpdateWidget(covariant SyncPulse old) {
    super.didUpdateWidget(old);
    if (old.trigger != widget.trigger && !Motion.reduced(context)) {
      _c.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      widget.child,
      Positioned.fill(
        child: IgnorePointer(
          child: AnimatedBuilder(
            animation: _c,
            builder: (context, _) {
              final o = _c.isAnimating ? (1 - _c.value) * 0.10 : 0.0;
              return o == 0
                  ? const SizedBox.shrink()
                  : ColoredBox(color: AppColors.blue.withValues(alpha: o));
            },
          ),
        ),
      ),
    ],
  );
}

/// Drop-in for a vertical [ListView] whose children reveal in turn.
class StaggeredListView extends StatelessWidget {
  const StaggeredListView({super.key, this.padding, required this.children});

  final EdgeInsetsGeometry? padding;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) =>
      ListView(padding: padding, children: staggered(children));
}

/// Drop-in for a [Column] whose children reveal in turn.
class StaggeredColumn extends StatelessWidget {
  const StaggeredColumn({
    super.key,
    this.crossAxisAlignment = CrossAxisAlignment.center,
    required this.children,
  });

  final CrossAxisAlignment crossAxisAlignment;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: crossAxisAlignment,
    children: staggered(children),
  );
}

/// Slim banner that slides in for a few seconds whenever school data changed
/// on the server (see core/live_sync.dart).
class LiveSyncBanner extends StatefulWidget {
  const LiveSyncBanner({super.key});

  @override
  State<LiveSyncBanner> createState() => _LiveSyncBannerState();
}

class _LiveSyncBannerState extends State<LiveSyncBanner> {
  bool _show = false;
  Timer? _hide;

  @override
  void initState() {
    super.initState();
    LiveSync.instance.addListener(_onSync);
  }

  void _onSync() {
    if (!mounted) return;
    setState(() => _show = true);
    _hide?.cancel();
    _hide = Timer(const Duration(seconds: 4), () {
      if (mounted) setState(() => _show = false);
    });
  }

  @override
  void dispose() {
    _hide?.cancel();
    LiveSync.instance.removeListener(_onSync);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedSwitcher(
    duration: Motion.slow,
    transitionBuilder: (child, a) => SizeTransition(
      sizeFactor: a,
      child: FadeTransition(opacity: a, child: child),
    ),
    child: !_show
        ? const SizedBox(width: double.infinity)
        : Container(
            key: const ValueKey('sync'),
            width: double.infinity,
            color: AppColors.success.withValues(alpha: 0.12),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                const Icon(
                  Icons.sync_rounded,
                  size: 18,
                  color: AppColors.success,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    context.l10n.updatedFromSchool,
                    style: const TextStyle(
                      color: AppColors.success,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
          ),
  );
}
