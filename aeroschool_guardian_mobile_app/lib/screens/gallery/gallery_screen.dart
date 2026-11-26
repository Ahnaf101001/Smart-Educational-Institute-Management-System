import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/format.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../l10n/l10n_ext.dart';
import '../../models/campus.dart';
import '../../providers/locale_provider.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';

/// School photo gallery (OM-05v1): event albums the school published for guardians.
class GalleryScreen extends StatelessWidget {
  const GalleryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final service = context.read<GuardianService>();
    final bangla = context.watch<LocaleProvider>().isBangla;
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.photoGallery)),
      body: AsyncView<List<GalleryAlbum>>(
        load: service.gallery,
        builder: (context, albums, reload) => RefreshIndicator(
          onRefresh: reload,
          child: albums.isEmpty
              ? ListView(
                  children: [
                    EmptyView(
                      title: context.l10n.noAlbums,
                      subtitle: context.l10n.noAlbumsHint,
                      icon: Icons.photo_library_outlined,
                    ),
                  ],
                )
              : LayoutBuilder(
                  builder: (context, c) => GridView.count(
                    padding: const EdgeInsets.all(16),
                    crossAxisCount: c.maxWidth > 600 ? 3 : 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.82,
                    children: staggered(press: true, [
                      for (final a in albums)
                        _AlbumCard(
                          album: a,
                          title: a.titleFor(bangla),
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute<void>(
                              builder: (_) => AlbumScreen(
                                album: a,
                                title: a.titleFor(bangla),
                              ),
                            ),
                          ),
                        ),
                    ]),
                  ),
                ),
        ),
      ),
    );
  }
}

class _Photo extends StatelessWidget {
  const _Photo({required this.url, this.fit = BoxFit.cover});

  final String? url;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final resolved = PersonAvatar.resolve(url);
    if (resolved == null) {
      return const ColoredBox(
        color: AppColors.surfaceTint,
        child: Center(
          child: Icon(Icons.photo_outlined, color: AppColors.muted),
        ),
      );
    }
    return Image.network(
      resolved,
      fit: fit,
      errorBuilder: (_, _, _) => const ColoredBox(
        color: AppColors.surfaceTint,
        child: Center(
          child: Icon(Icons.broken_image_outlined, color: AppColors.muted),
        ),
      ),
    );
  }
}

class _AlbumCard extends StatelessWidget {
  const _AlbumCard({
    required this.album,
    required this.title,
    required this.onTap,
  });

  final GalleryAlbum album;
  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: _Photo(url: album.cover)),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    if (album.eventDate != null) Fmt.date(album.eventDate),
                    context.l10n.photoCount(album.photos.length),
                  ].join(' • '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class AlbumScreen extends StatelessWidget {
  const AlbumScreen({super.key, required this.album, required this.title});

  final GalleryAlbum album;
  final String title;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(title)),
    body: album.photos.isEmpty
        ? EmptyView(title: context.l10n.noPhotosYet, icon: Icons.photo_outlined)
        : CustomScrollView(
            slivers: [
              if (album.description != null)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  sliver: SliverToBoxAdapter(child: Text(album.description!)),
                ),
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: SliverGrid.count(
                  crossAxisCount: 3,
                  mainAxisSpacing: 6,
                  crossAxisSpacing: 6,
                  children: [
                    for (final (i, p) in album.photos.indexed)
                      Semantics(
                        button: true,
                        label: p.caption ?? context.l10n.openPhoto,
                        child: GestureDetector(
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute<void>(
                              builder: (_) => _PhotoViewer(
                                photos: album.photos,
                                initial: i,
                              ),
                            ),
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: _Photo(url: p.imageUrl),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
  );
}

/// Full-screen swipeable photo viewer with pinch-to-zoom.
class _PhotoViewer extends StatefulWidget {
  const _PhotoViewer({required this.photos, required this.initial});

  final List<GalleryPhoto> photos;
  final int initial;

  @override
  State<_PhotoViewer> createState() => _PhotoViewerState();
}

class _PhotoViewerState extends State<_PhotoViewer> {
  late final PageController _pages = PageController(
    initialPage: widget.initial,
  );
  late int _index = widget.initial;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final caption = widget.photos[_index].caption;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text('${_index + 1} / ${widget.photos.length}'),
      ),
      body: Column(
        children: [
          Expanded(
            child: PageView.builder(
              controller: _pages,
              itemCount: widget.photos.length,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (context, i) => InteractiveViewer(
                minScale: 1,
                maxScale: 4,
                child: Center(
                  child: _Photo(
                    url: widget.photos[i].imageUrl,
                    fit: BoxFit.contain,
                  ),
                ),
              ),
            ),
          ),
          if (caption != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                caption,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white),
              ),
            ),
        ],
      ),
    );
  }
}
