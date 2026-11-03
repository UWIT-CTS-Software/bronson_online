FROM registry.fedoraproject.org/fedora:latest
EXPOSE 7878

RUN sudo dnf install -y cargo rustc gnupg wget postgresql postgresql-server postgresql-libs gcc openssl-devel libpq-devel git ping texlive
RUN cargo --version && \
    rustc --version
RUN sudo dnf update -y
RUN git clone -b main https://github.com/UWIT-CTS-Software/bronson_online.git
WORKDIR /bronson_online
RUN git clone https://github.com/UWIT-CTS-Software/CFM_Code.git
RUN cargo build --profile release