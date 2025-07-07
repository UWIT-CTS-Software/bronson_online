// @generated automatically by Diesel CLI.

diesel::table! {
    admins (admin) {
        #[max_length = 255]
        admin -> Varchar,
    }
}

diesel::table! {
    buildings (abbrev) {
        #[max_length = 5]
        abbrev -> Varchar,
        #[max_length = 255]
        name -> Varchar,
        #[max_length = 255]
        lsm_name -> Varchar,
        zone -> Int2,
    }
}

diesel::table! {
    data (key) {
        #[max_length = 255]
        key -> Varchar,
        val -> Text,
    }
}

diesel::table! {
    rooms (abbrev) {
        #[max_length = 5]
        abbrev -> Varchar,
        #[max_length = 10]
        name -> Varchar,
        checked -> Bool,
        #[max_length = 21]
        last_checked -> Varchar,
        gp -> Bool,
        available -> Bool,
        #[max_length = 9]
        until -> Varchar,
        hostnames -> Array<Nullable<Text>>,
        ips -> Array<Nullable<Text>>,
    }
}

diesel::joinable!(rooms -> buildings (abbrev));

diesel::allow_tables_to_appear_in_same_query!(
    admins,
    buildings,
    data,
    rooms,
);
